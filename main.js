"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require("@iobroker/adapter-core");
const Device = require("./lib/Device.js");
const axios = require("axios");
const https = require("node:https");
const axiosRetry = require("axios-retry").default;

const RETRYABLE_READ_COMMANDS = new Set(["getDeviceInfo", "getAirconStat"]);
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const POLL_FAILURE_THRESHOLD = 3;

function shouldRetryRequest(error) {
    if (!error?.config) {
        return false;
    }

    let requestData = error.config.data;
    if (typeof requestData === "string") {
        try {
            requestData = JSON.parse(requestData);
        } catch {
            return false;
        }
    }

    if (!RETRYABLE_READ_COMMANDS.has(requestData?.command)) {
        return false;
    }

    // No HTTP response usually means a transient network error or timeout.
    if (!error.response) {
        return true;
    }

    // Do not retry permanent client errors (including HTTP 501).
    return RETRYABLE_HTTP_STATUS_CODES.has(error.response.status);
}

axiosRetry(axios, {
    retries: 4,
    retryDelay: retryCount => retryCount * 2000,
    shouldResetTimeout: true,
    retryCondition: shouldRetryRequest,
});

const KEY_AIRCON_ID = "airconId";
const KEY_AIRCON_STAT = "airconStat";

const OPERATORID = "d2bc4571-1cea-4858-b0f2-34c18bef1901";
const TIMEZONE = "Europe/Berlin";
const AIRCON_PORT = 51443;
const AIRCON_DEVICEID = "18547566-315b-4941-bb9b-90cedef4bbb7";

const COMMAND_GET_DEVICE_INFO = "getDeviceInfo";
const COMMAND_SET_AIRCON_STAT = "setAirconStat";
const COMMAND_UPDATE_ACCOUNT_INFO = "updateAccountInfo";
const COMMAND_GET_AIRCON_STAT = "getAirconStat";
const BEAVER_COMMAND_PATH = "/beaver/command";
const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

class MHIWFRac extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "mhi-wfrac",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.devices = {};
        this.unloading = false;
        this.registrationRetryAt = new Map();
        this.deviceCommandQueues = new Map();
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        this.resetConnectionState();
        this.setState("info.connection", false, true);

        // validate interval and set fallback values
        if (!this.config.interval) {
            this.log.warn("Interval not set, setting to default value (20s)!");
            this.config.interval = 20;
        } else if (this.config.interval > 3600) {
            this.log.warn("Interval too high, setting to highest value (3600s)!");
            this.config.interval = 3600;
        } else if (this.config.interval < 5) {
            this.log.warn("Interval too low, set to default value (20s)!");
            this.config.interval = 20;
        }

        for (const device of this.config.devices) {
            if (device["enabled"]) {
                this.log.debug(`onReady::register(${device["ip"]}/${device["name"]})`);
                try {
                    await this.register(device["ip"], device["name"]);
                } catch (error) {
                    this.log.error(
                        `Failed to register configured device ${device["name"]} (${device["ip"]}): ${error}`,
                    );
                }
            }
        }

        for (const device of Object.values(this.devices)) {
            this.log.debug("onReady::initIOBStates");
            try {
                await this.initIOBStates(device);
            } catch (error) {
                this.log.error(`${device.name}: Failed to initialize ioBroker states: ${error}`);
            }
        }

        this.update();
    }

    resetConnectionState() {
        this.getStatesOf((error, states) => {
            if (states) {
                for (const state of states) {
                    if (state._id.endsWith("online")) {
                        this.setState(state._id, false, true);
                    }
                }
            }
        });
    }

    async setStateVal(id, state) {
        const object = await this.getObjectAsync(id);
        const airconId = object?.native?.airconId;
        const device = this.devices[airconId];
        if (!device) {
            this.log.warn(`Ignoring state change for ${id}: device ${airconId || "unknown"} is not registered`);
            return;
        }

        // Serialize writes per device so overlapping state changes cannot race
        // while encoding, sending, or applying the returned device status.
        const previous = this.deviceCommandQueues.get(airconId) || Promise.resolve();
        const operation = previous
            .catch(() => {})
            .then(async () => {
                const val = state.val;
                let valchange = 0;
                let idS = "";
                const h = id.split(".");
                if (h.length == 4) {
                    idS = h[3];
                }
                const changedProperty = {
                    power: "operation",
                    mode: "operationMode",
                    fanSpeed: "airFlow",
                    targetTemperature: "presetTemp",
                    swingLeftRight: "windDirectionLR",
                    swingUpDown: "windDirectionUD",
                    "3dAuto": "entrust",
                }[idS];
                const previousValue = changedProperty ? device.airconStat[changedProperty] : undefined;
                switch (idS) {
                    case "power":
                        device.airconStat.operation = val;
                        valchange++;
                        break;
                    case "mode":
                        device.airconStat.operationMode = val;
                        valchange++;
                        break;
                    case "fanSpeed":
                        device.airconStat.airFlow = val;
                        valchange++;
                        break;
                    case "targetTemperature":
                        device.airconStat.presetTemp = val;
                        valchange++;
                        break;
                    case "swingLeftRight":
                        device.airconStat.windDirectionLR = val;
                        valchange++;
                        break;
                    case "swingUpDown":
                        device.airconStat.windDirectionUD = val;
                        valchange++;
                        break;
                    case "3dAuto":
                        device.airconStat.entrust = val;
                        valchange++;
                        break;
                }
                if (valchange > 0) {
                    const sent = await this.sendDataToDevice(device);
                    if (sent) {
                        await this.setIOBStates(device);
                    } else {
                        // Keep the in-memory model aligned with the last confirmed device state.
                        device.airconStat[changedProperty] = previousValue;
                    }
                }
            });
        this.deviceCommandQueues.set(airconId, operation);
        try {
            await operation;
        } finally {
            if (this.deviceCommandQueues.get(airconId) === operation) {
                this.deviceCommandQueues.delete(airconId);
            }
        }
    }

    async setIOBStates(device) {
        const airconChannel = this.name2id(device.airconId);
        try {
            await this.setState(`${airconChannel}.power`, device.airconStat.operation, true);
            await this.setState(`${airconChannel}.mode`, device.airconStat.operationMode, true);
            await this.setState(`${airconChannel}.fanSpeed`, device.airconStat.airFlow, true);
            await this.setState(`${airconChannel}.model`, device.airconStat.modelNo.toString(), true);
            await this.setState(`${airconChannel}.indoorTemperature`, device.airconStat.indoorTemp, true);
            await this.setState(`${airconChannel}.outdoorTemperature`, device.airconStat.outdoorTemp, true);
            await this.setState(`${airconChannel}.targetTemperature`, device.airconStat.presetTemp, true);
            await this.setState(`${airconChannel}.swingLeftRight`, device.airconStat.windDirectionLR, true);
            await this.setState(`${airconChannel}.swingUpDown`, device.airconStat.windDirectionUD, true);
            await this.setState(`${airconChannel}.coolHotJudge`, device.airconStat.coolHotJudge, true);
            await this.setState(`${airconChannel}.electric`, device.airconStat.electric, true);
            await this.setState(`${airconChannel}.3dAuto`, device.airconStat.entrust, true);
            await this.setState(`${airconChannel}.errorCode`, device.airconStat.errorCode, true);
            await this.setState(`${airconChannel}.selfCleanOperation`, device.airconStat.isSelfCleanOperation, true);
            await this.setState(`${airconChannel}.selfCleanReset`, device.airconStat.isSelfCleanReset, true);
            await this.setState(`${airconChannel}.vacant`, device.airconStat.isVacantProperty == 1, true);
            await this.setState(`${airconChannel}.apMode`, device.airconApMode, true);
            await this.setState(`${airconChannel}.airconId`, device.airconId, true);
            await this.setState(`${airconChannel}.macAddress`, device.airconMac, true);
            await this.setState(`${airconChannel}.ledStatus`, device.ledStat, true);
            await this.setState(`${airconChannel}.firmwareType`, device.firmwareType, true);
            await this.setState(`${airconChannel}.wirelessFirmwareVersion`, device.firmwareVersion_wireless, true);
            await this.setState(`${airconChannel}.mcuFirmwareVersion`, device.firmwareVersion_mcu, true);
            await this.setState(`${airconChannel}.accounts`, device.connected_accounts, true);
            await this.setState(`${airconChannel}.autoHeating`, device.autoHeating, true);
            await this.setState(`${airconChannel}.online`, device.online, true);
        } catch (e) {
            this.log.error(
                `${device.name}: Failed to publish ioBroker states: ${e} | AirconStat: ${JSON.stringify(device.airconStat)}`,
            );
        }
    }

    async initIOBStates(device) {
        const airconChannel = this.name2id(device.airconId);
        const airconId = device.airconId;

        await this.setObjectNotExistsAsync(airconChannel, {
            type: "channel",
            common: {
                name: device.name,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.power`, {
            type: "state",
            common: {
                name: "Power",
                type: "boolean",
                role: "switch.power",
                read: true,
                write: true,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.power`);

        await this.setObjectNotExistsAsync(`${airconChannel}.mode`, {
            type: "state",
            common: {
                name: "Operation Mode",
                type: "number",
                role: "level.mode.airconditioner",
                read: true,
                write: true,
                min: 0,
                max: 4,
                states: {
                    0: "Auto",
                    1: "Cool",
                    2: "Heat",
                    3: "FanOnly",
                    4: "Dry",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.mode`);

        await this.setObjectNotExistsAsync(`${airconChannel}.fanSpeed`, {
            type: "state",
            common: {
                name: "Fan Speed",
                type: "number",
                role: "level.mode.fan",
                read: true,
                write: true,
                min: 0,
                max: 4,
                states: {
                    0: "Auto",
                    1: "Min",
                    2: "Medium",
                    3: "High",
                    4: "Turbo",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.fanSpeed`);

        await this.setObjectNotExistsAsync(`${airconChannel}.model`, {
            type: "state",
            common: {
                name: "Model Number",
                type: "string",
                role: "info.model",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.model`);

        await this.setObjectNotExistsAsync(`${airconChannel}.indoorTemperature`, {
            type: "state",
            common: {
                name: "Indoor Temperature",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.outdoorTemperature`, {
            type: "state",
            common: {
                name: "Outdoor Temperature",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.targetTemperature`, {
            type: "state",
            common: {
                name: "Target Temperature",
                type: "number",
                role: "level.temperature",
                unit: "°C",
                read: true,
                write: true,
                min: 18,
                max: 30,
                step: 0.5,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.targetTemperature`);

        await this.setObjectNotExistsAsync(`${airconChannel}.swingLeftRight`, {
            type: "state",
            common: {
                name: "Swing Left/Right",
                type: "number",
                role: "level.mode.swing",
                read: true,
                write: true,
                min: 0,
                max: 7,
                states: {
                    0: "Auto",
                    1: "Left",
                    2: "SlightlyLeft",
                    3: "Middle",
                    4: "SlightlyRight",
                    5: "Right",
                    6: "Wide",
                    7: "Spot",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.swingLeftRight`);

        await this.setObjectNotExistsAsync(`${airconChannel}.swingUpDown`, {
            type: "state",
            common: {
                name: "Swing Up/Down",
                type: "number",
                role: "level.mode.swing",
                read: true,
                write: true,
                min: 0,
                max: 4,
                states: {
                    0: "Auto",
                    1: "Higher",
                    2: "SlightlyHigher",
                    3: "SlightlyLower",
                    4: "Lower",
                },
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.swingUpDown`);

        await this.setObjectNotExistsAsync(`${airconChannel}.coolHotJudge`, {
            type: "state",
            common: {
                name: "Cool Hot Judge",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.electric`, {
            type: "state",
            common: {
                name: "electric",
                type: "number",
                role: "value.energy",
                unit: "kWh",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.3dAuto`, {
            type: "state",
            common: {
                name: "3D Auto",
                type: "boolean",
                role: "switch",
                read: true,
                write: true,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.3dAuto`);

        await this.setObjectNotExistsAsync(`${airconChannel}.errorCode`, {
            type: "state",
            common: {
                name: "Error Code",
                type: "string",
                role: "value.warning",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.selfCleanOperation`, {
            type: "state",
            common: {
                name: "Self Clean Operation",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.selfCleanReset`, {
            type: "state",
            common: {
                name: "Self Clean Reset",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.vacant`, {
            type: "state",
            common: {
                name: "Vacant",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.apMode`, {
            type: "state",
            common: {
                name: "AP Mode",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.airconId`, {
            type: "state",
            common: {
                name: "Airconditioner ID",
                type: "string",
                role: "info.address",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.macAddress`, {
            type: "state",
            common: {
                name: "MAC Address",
                type: "string",
                role: "info.mac",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.ledStatus`, {
            type: "state",
            common: {
                name: "LED Status",
                type: "number",
                role: "info.status",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.firmwareType`, {
            type: "state",
            common: {
                name: "Firmware Type",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.wirelessFirmwareVersion`, {
            type: "state",
            common: {
                name: "Wireless Firmware Version",
                type: "string",
                role: "info.firmware",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.mcuFirmwareVersion`, {
            type: "state",
            common: {
                name: "MCU Firmware Version",
                type: "string",
                role: "info.firmware",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.accounts`, {
            type: "state",
            common: {
                name: "Accounts",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.autoHeating`, {
            type: "state",
            common: {
                name: "Auto Heating",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });

        await this.setObjectNotExistsAsync(`${airconChannel}.online`, {
            type: "state",
            common: {
                name: "Device Online",
                type: "boolean",
                role: "indicator.reachable",
                read: true,
                write: false,
            },
            native: { airconId: airconId },
        });
        this.subscribeStates(`${airconChannel}.online`);
    }

    async update() {
        try {
            try {
                await this.retryMissingDevices();
            } catch (error) {
                this.log.error(`Failed to retry unavailable device registration: ${error}`);
            }

            for (const device of Object.values(this.devices)) {
                const airconId = device.airconId;
                // Polling and user-initiated writes must share the same per-device queue.
                const previous = this.deviceCommandQueues.get(airconId) || Promise.resolve();
                const operation = previous
                    .catch(() => {})
                    .then(async () => {
                        try {
                            await this.getDataFromDevice(device);
                            await this.setIOBStates(device);
                        } catch (error) {
                            try {
                                this.errorHandler(device, `Unexpected update error: ${error}`);
                            } catch (handlerError) {
                                this.log.error(
                                    `Failed to handle update error for ${device.name || device.airconId}: ${handlerError}`,
                                );
                            }
                        }
                    });
                this.deviceCommandQueues.set(airconId, operation);
                try {
                    await operation;
                } finally {
                    if (this.deviceCommandQueues.get(airconId) === operation) {
                        this.deviceCommandQueues.delete(airconId);
                    }
                }
            }

            try {
                this.updateConnectionInfo();
            } catch (error) {
                this.log.error(`Failed to update adapter connection state: ${error}`);
            }
        } finally {
            if (!this.unloading) {
                this.timeout = this.setTimeout(() => this.update(), this.config.interval * 1000);
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback
     */
    onUnload(callback) {
        this.unloading = true;

        // A failure for one device must not prevent cleanup of the remaining devices.
        if (this.timeout) {
            try {
                this.clearTimeout(this.timeout);
            } catch (error) {
                this.log.error(`Failed to clear polling timeout during shutdown: ${error}`);
            }
        }

        Object.values(this.devices).forEach(device => {
            try {
                this.setOnlineState(device, false);
            } catch (error) {
                this.log.error(`Failed to set ${device.name || device.airconId} offline during shutdown: ${error}`);
            }
        });

        try {
            this.setState("info.connection", false, true);
        } catch (error) {
            this.log.error(`Failed to reset adapter connection state during shutdown: ${error}`);
        }

        // Invoke the controller callback exactly once, outside cleanup error handling.
        callback();
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if (state.ack === false) {
                this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                return this.setStateVal(id, state).catch(error => {
                    this.log.error(`Failed to process state change for ${id}: ${error}`);
                });
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    async _post(address, cmd, contents) {
        return this._postConnection(
            {
                address,
                useHttps: false,
            },
            cmd,
            contents,
        );
    }

    buildDeviceUrl(connection, cmd) {
        const address = connection.airconAddress || connection.address;
        const protocol = connection.useHttps ? "https" : "http";
        const baseUrl = `${protocol}://${address}:${AIRCON_PORT}`;
        return `${baseUrl}${BEAVER_COMMAND_PATH}/${cmd}`;
    }

    shouldRetryRequest(error) {
        return shouldRetryRequest(error);
    }

    assertSuccessfulResponse(response, command) {
        if (!response || typeof response !== "object") {
            throw new Error(`${command} returned an invalid response`);
        }
        if (response.result !== 0) {
            throw new Error(`${command} was rejected by the device (result: ${String(response.result)})`);
        }
        return response;
    }

    async _postConnection(connection, cmd, contents, options = {}) {
        const url = this.buildDeviceUrl(connection, cmd);

        const data = {
            apiVer: "1.0",
            command: cmd,
            deviceId: AIRCON_DEVICEID,
            operatorId: OPERATORID,
            timestamp: Math.floor(Date.now() / 1000),
        };
        if (contents !== undefined && contents !== "") {
            data["contents"] = contents;
        }

        const ret = { error: "", response: {} };
        this.log.debug(`_post | url:${url}::data: ${cmd}::${JSON.stringify(data)}`);

        await axios
            .post(url, data, {
                timeout: 5000, // Set a timeout of 5 seconds
                httpsAgent: connection.useHttps ? HTTPS_AGENT : undefined,
                ...(options.disableRetry ? { "axios-retry": { retries: 0 } } : {}),
                headers: {
                    Connection: "close",
                    "Content-Type": "application/json;charset=UTF-8",
                    "Access-Control-Allow-Origin": "*",
                    accept: "application/json",
                },
            })
            .then(response => {
                ret.response = response.data;
                this.log.debug(`_post | return: ${cmd}::${JSON.stringify(response.data)}`);
            });

        return ret;
    }

    async detectDeviceConnection(address) {
        const candidates = [
            { address, useHttps: false },
            { address, useHttps: true },
        ];

        for (const candidate of candidates) {
            try {
                const ret = await this._postConnection(candidate, COMMAND_GET_DEVICE_INFO, undefined, {
                    disableRetry: true,
                });
                if (ret.response?.result === 0 && ret.response?.contents?.airconId) {
                    this.log.info(`Detected local API for ${address}: ${candidate.useHttps ? "https" : "http"}`);
                    return {
                        useHttps: candidate.useHttps,
                    };
                }
            } catch (error) {
                this.log.debug(
                    `Device probe failed for ${address} via ${candidate.useHttps ? "https" : "http"}: ${error}`,
                );
            }
        }

        throw new Error(`Unable to detect local API mode for device ${address}`);
    }

    async update_account_info(device) {
        // Update the account info on the airco (sets to operator id of the device)
        const contents = {
            accountId: OPERATORID,
            [KEY_AIRCON_ID]: device.airconId,
            remote: 0,
            timezone: TIMEZONE,
        };
        try {
            const ret = await this._postConnection(device, COMMAND_UPDATE_ACCOUNT_INFO, contents);
            this.assertSuccessfulResponse(ret.response, COMMAND_UPDATE_ACCOUNT_INFO);
        } catch (error) {
            // Account metadata is optional; a failure must not mark a reachable device offline.
            this.log.error(`${device.name}: Failed to update account info on device: ${error}`);
        }
    }

    async register(address, name) {
        const registeredAtAddress = Object.values(this.devices).find(device => device.airconAddress === address);
        if (registeredAtAddress) {
            this.log.warn(
                `Skipping duplicate registration for ${name} (${address}); already registered as ${registeredAtAddress.airconId}`,
            );
            this.registrationRetryAt.delete(address);
            return;
        }

        const device = new Device(this.log);
        device.name = name;
        device.airconAddress = address;

        try {
            Object.assign(device, await this.detectDeviceConnection(address));

            const ret = await this._postConnection(device, COMMAND_GET_DEVICE_INFO);
            const response = this.assertSuccessfulResponse(ret.response, COMMAND_GET_DEVICE_INFO);
            const deviceInfo = response.contents;
            if (!deviceInfo?.airconId) {
                throw new Error("getDeviceInfo returned no airconId");
            }

            this.log.debug(`Register(${address}) | return: ${JSON.stringify(ret)}`);
            device.airconId = deviceInfo.airconId;

            const existingDevice = this.devices[device.airconId];
            if (existingDevice) {
                this.registrationRetryAt.set(address, Date.now() + 5 * 60 * 1000);
                this.log.error(
                    `Cannot register ${name} (${address}): airconId ${device.airconId} is already registered at ${existingDevice.airconAddress}`,
                );
                return;
            }

            device.airconApMode = deviceInfo.apMode ?? 0;
            device.airconMac = deviceInfo.macAddress ?? "";
            device.online = true;
            this.devices[device.airconId] = device;

            await this.update_account_info(device);
        } catch (error) {
            this.registrationRetryAt.set(address, Date.now() + 5 * 60 * 1000);
            this.errorHandler(device, `Failed to register device! | ${error}`);
        }
    }

    async retryMissingDevices() {
        const now = Date.now();
        const configuredDevices = /** @type {Array<{ enabled: boolean, ip: string, name: string }>} */ (
            this.config.devices
        );
        for (const configuredDevice of configuredDevices.filter(device => device.enabled)) {
            const address = configuredDevice.ip;
            const alreadyRegistered = Object.values(this.devices).some(device => device.airconAddress === address);
            if (alreadyRegistered) {
                this.registrationRetryAt.delete(address);
                continue;
            }

            const nextAttempt = this.registrationRetryAt.get(address) ?? 0;
            if (now < nextAttempt) {
                continue;
            }

            try {
                this.log.info(`Retrying registration for unavailable device ${configuredDevice.name} (${address})`);
                await this.register(address, configuredDevice.name);

                const registeredDevice = Object.values(this.devices).find(device => device.airconAddress === address);
                if (registeredDevice) {
                    try {
                        await this.initIOBStates(registeredDevice);
                    } catch (error) {
                        this.log.error(
                            `${registeredDevice.name}: Failed to initialize states after registration: ${error}`,
                        );
                    }
                }
            } catch (error) {
                // A failure for one configured endpoint must not block retries for later devices.
                this.log.error(`Failed to retry registration for ${configuredDevice.name} (${address}): ${error}`);
            }
        }
    }

    errorHandler(device, error) {
        this.log.error(`${device.name}: ${error}`);
        this.setOnlineState(device, false);
        this.updateConnectionInfo();
    }

    setOnlineState(device, online) {
        if (device) {
            const airconChannel = this.name2id(device.airconId);
            if (airconChannel) {
                device.online = online;
                this.setState(`${airconChannel}.online`, online, true);
            }
        }
    }

    updateConnectionInfo() {
        // Multiple configuration rows for the same IP represent one physical endpoint.
        const configuredDevices = /** @type {Array<{ enabled: boolean, ip: string }>} */ (this.config.devices);
        const enabledIps = configuredDevices.filter(device => device.enabled).map(device => device.ip);
        const enabledDevices = new Set(enabledIps).size;
        const onlineDevices = Object.values(this.devices).filter(d => d.online).length;

        // No configured devices must not be reported as a successful connection.
        this.setState("info.connection", enabledDevices > 0 && enabledDevices === onlineDevices, true);
    }

    async getDataFromDevice(device) {
        const contents = {
            [KEY_AIRCON_ID]: device.airconId,
        };
        try {
            const ret = await this._postConnection(device, COMMAND_GET_AIRCON_STAT, contents);
            const response = this.assertSuccessfulResponse(ret.response, COMMAND_GET_AIRCON_STAT);
            const stat = response.contents;
            if (!stat || typeof stat.airconStat !== "string" || stat.airconStat.length === 0) {
                throw new Error("getAirconStat returned no airconStat");
            }

            const previousPollFailures = device.pollFailureCount || 0;
            device.acCoder.fromBase64(device.airconStat, stat.airconStat);
            device.pollFailureCount = 0;
            this.log.debug(`getDataFromDevice | AirconStat::${JSON.stringify(device.airconStat)}`);
            device.firmwareVersion_wireless = stat.wireless?.firmVer ?? "";
            device.firmwareVersion_mcu = stat.mcu?.firmVer ?? "";
            device.firmwareType = stat.firmType ?? "";
            device.connected_accounts = stat.numOfAccount ?? 0;
            device.ledStat = stat.ledStat ?? 0;
            device.autoHeating = stat.autoHeating ?? 0;
            device.online = true;
            if (previousPollFailures >= POLL_FAILURE_THRESHOLD) {
                this.log.info(`${device.name}: Device is reachable again after ${previousPollFailures} failed polls`);
                this.updateConnectionInfo();
            }
        } catch (error) {
            device.pollFailureCount = (device.pollFailureCount || 0) + 1;
            if (device.pollFailureCount < POLL_FAILURE_THRESHOLD) {
                this.log.debug(
                    `${device.name}: Poll failed (${device.pollFailureCount}/${POLL_FAILURE_THRESHOLD}); keeping device online: ${error}`,
                );
            } else if (device.pollFailureCount === POLL_FAILURE_THRESHOLD) {
                this.errorHandler(device, `Could not get Data after ${POLL_FAILURE_THRESHOLD} failed polls: ${error}`);
            } else {
                this.log.debug(`${device.name}: Poll still failing (${device.pollFailureCount} consecutive failures)`);
            }
        }
    }

    async sendDataToDevice(device) {
        const contents = {
            [KEY_AIRCON_ID]: device.airconId,
            [KEY_AIRCON_STAT]: device.acCoder.toBase64(device.airconStat),
        };

        try {
            const ret = await this._postConnection(device, COMMAND_SET_AIRCON_STAT, contents);
            const response = this.assertSuccessfulResponse(ret.response, COMMAND_SET_AIRCON_STAT);
            const stat = response.contents;
            if (!stat || typeof stat.airconStat !== "string" || stat.airconStat.length === 0) {
                throw new Error("setAirconStat returned no airconStat");
            }
            device.acCoder.fromBase64(device.airconStat, stat.airconStat);
            return true;
        } catch (error) {
            this.errorHandler(device, `Could not send Data: ${error}`);
            return false;
        }
    }

    name2id(pName) {
        return (pName || "").replace(this.FORBIDDEN_CHARS, "_");
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = options => new MHIWFRac(options);
} else {
    // otherwise start the instance directly
    new MHIWFRac();
}
