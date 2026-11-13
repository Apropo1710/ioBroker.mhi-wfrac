"use strict";

const { expect } = require("chai");
const EventEmitter = require("node:events");
const proxyquire = require("proxyquire").noCallThru();

const axiosCalls = [];
const axiosStub = {
    post: async (...args) => {
        axiosCalls.push(args);
        return { data: { result: 0 } };
    },
};
let configuredRetryOptions;
const axiosRetryStub = (instance, options) => {
    expect(instance).to.equal(axiosStub);
    configuredRetryOptions = options;
};

class FakeAdapter extends EventEmitter {
    constructor(options) {
        super();
        this.name = options.name;
        this.FORBIDDEN_CHARS = /[^\w-]/g;
        this.log = {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
        };
    }
}

const createAdapter = proxyquire("./main.js", {
    "@iobroker/adapter-core": {
        Adapter: FakeAdapter,
    },
    axios: axiosStub,
    "axios-retry": {
        default: axiosRetryStub,
    },
});

describe("MHIWFRac state handling", () => {
    let adapter;

    beforeEach(() => {
        axiosCalls.length = 0;
        adapter = createAdapter({});
    });

    it("keeps devices online and continues initializing when state initialization fails", async () => {
        const firstDevice = { name: "room-1", airconId: "id-1", online: true };
        const secondDevice = { name: "room-2", airconId: "id-2", online: true };
        const initialized = [];
        const errors = [];
        let updateCalled = false;

        adapter.config = { interval: 20, devices: [] };
        adapter.devices = { [firstDevice.airconId]: firstDevice, [secondDevice.airconId]: secondDevice };
        adapter.resetConnectionState = () => {};
        adapter.setState = () => {};
        adapter.initIOBStates = async device => {
            initialized.push(device.airconId);
            if (device === firstDevice) {
                throw new Error("database unavailable");
            }
        };
        adapter.log.error = message => errors.push(message);
        adapter.errorHandler = () => {
            throw new Error("State initialization must not mark a device offline");
        };
        adapter.update = () => {
            updateCalled = true;
        };

        await adapter.onReady();

        expect(initialized).to.deep.equal(["id-1", "id-2"]);
        expect(firstDevice.online).to.equal(true);
        expect(secondDevice.online).to.equal(true);
        expect(errors).to.have.lengthOf(1);
        expect(errors[0]).to.contain("database unavailable");
        expect(updateCalled).to.equal(true);
    });

    it("serializes concurrent state writes for the same device", async () => {
        const device = {
            name: "room",
            airconId: "id-queue",
            airconStat: { operation: false, operationMode: 0 },
        };
        const sentValues = [];
        let releaseFirst;
        let firstStarted;
        const firstStartedPromise = new Promise(resolve => {
            firstStarted = resolve;
        });
        const firstSendPromise = new Promise(resolve => {
            releaseFirst = resolve;
        });

        adapter.devices = { [device.airconId]: device };
        adapter.getObjectAsync = async id => ({
            native: { airconId: device.airconId },
        });
        adapter.sendDataToDevice = async currentDevice => {
            sentValues.push({
                operation: currentDevice.airconStat.operation,
                operationMode: currentDevice.airconStat.operationMode,
            });
            if (sentValues.length === 1) {
                firstStarted();
                await firstSendPromise;
            }
        };
        adapter.setIOBStates = async () => {};

        const firstWrite = adapter.setStateVal("mhi-wfrac.0.room.power", { val: true });
        await firstStartedPromise;
        const secondWrite = adapter.setStateVal("mhi-wfrac.0.room.mode", { val: 2 });

        await Promise.resolve();
        expect(sentValues).to.have.lengthOf(1);
        expect(sentValues[0]).to.deep.equal({ operation: true, operationMode: 0 });

        releaseFirst();
        await Promise.all([firstWrite, secondWrite]);

        expect(sentValues).to.have.lengthOf(2);
        expect(sentValues[1]).to.deep.equal({ operation: true, operationMode: 2 });
        expect(adapter.deviceCommandQueues.has(device.airconId)).to.equal(false);
    });

    it("does not poll a device while a state write is in progress", async () => {
        const device = {
            name: "room",
            airconId: "id-poll-queue",
            airconStat: { operation: false },
        };
        let releaseWrite;
        let writeStarted;
        const writeStartedPromise = new Promise(resolve => {
            writeStarted = resolve;
        });
        const writePromiseGate = new Promise(resolve => {
            releaseWrite = resolve;
        });
        let pollStarted = false;

        adapter.devices = { [device.airconId]: device };
        adapter.getObjectAsync = async () => ({
            native: { airconId: device.airconId },
        });
        adapter.sendDataToDevice = async () => {
            writeStarted();
            await writePromiseGate;
            return true;
        };
        adapter.setIOBStates = async () => {};
        adapter.getDataFromDevice = async () => {
            pollStarted = true;
        };
        adapter.updateConnectionInfo = () => {};
        adapter.config = { interval: 20 };
        adapter.setTimeout = () => 1;

        const write = adapter.setStateVal("mhi-wfrac.0.room.power", { val: true });
        await writeStartedPromise;
        const polling = adapter.update();

        await Promise.resolve();
        await Promise.resolve();
        expect(pollStarted).to.equal(false);

        releaseWrite();
        await Promise.all([write, polling]);

        expect(pollStarted).to.equal(true);
        expect(device.airconStat.operation).to.equal(true);
        expect(adapter.deviceCommandQueues.has(device.airconId)).to.equal(false);
    });

    it("keeps a reachable device online when optional account info update fails", async () => {
        const device = { name: "room", airconId: "account-info-device", online: true };
        const loggedErrors = [];
        const handledErrors = [];
        adapter._postConnection = async () => {
            throw new Error("optional command unavailable");
        };
        adapter.log.error = message => loggedErrors.push(message);
        adapter.errorHandler = (currentDevice, error) => handledErrors.push({ device: currentDevice, error });

        await adapter.update_account_info(device);

        expect(device.online).to.equal(true);
        expect(handledErrors).to.have.lengthOf(0);
        expect(loggedErrors).to.have.lengthOf(1);
        expect(loggedErrors[0]).to.contain("Failed to update account info");
        expect(loggedErrors[0]).to.contain("optional command unavailable");
    });

    it("does not register the same configured IP address more than once", async () => {
        const existing = { name: "living-room", airconId: "id-1", airconAddress: "192.0.2.20" };
        let detectionCalled = false;
        adapter.devices = { [existing.airconId]: existing };
        adapter.detectDeviceConnection = async () => {
            detectionCalled = true;
        };

        await adapter.register("192.0.2.20", "living-room-copy");

        expect(detectionCalled).to.equal(false);
        expect(adapter.devices[existing.airconId]).to.equal(existing);
    });

    it("does not overwrite an existing device when another IP reports the same airconId", async () => {
        const existing = { name: "living-room", airconId: "duplicate-id", airconAddress: "192.0.2.21" };
        const loggedErrors = [];
        let handledErrors = 0;
        adapter.devices = { [existing.airconId]: existing };
        adapter.detectDeviceConnection = async () => ({});
        adapter._postConnection = async () => ({
            response: { result: 0, contents: { airconId: "duplicate-id" } },
        });
        adapter.log.error = message => loggedErrors.push(message);
        adapter.errorHandler = () => {
            handledErrors++;
        };

        await adapter.register("192.0.2.22", "bedroom");

        expect(adapter.devices[existing.airconId]).to.equal(existing);
        expect(loggedErrors).to.have.lengthOf(1);
        expect(loggedErrors[0]).to.contain("already registered at 192.0.2.21");
        expect(handledErrors).to.equal(0);
        expect(adapter.registrationRetryAt.has("192.0.2.22")).to.equal(true);
    });

    it("counts duplicate configured IP addresses as one enabled device", () => {
        let connectionState;
        const device = { name: "living-room", airconId: "id-1", airconAddress: "192.0.2.23", online: true };
        adapter.config = {
            devices: [
                { enabled: true, ip: "192.0.2.23" },
                { enabled: true, ip: "192.0.2.23" },
            ],
        };
        adapter.devices = { [device.airconId]: device };
        adapter.setState = (_id, value) => {
            connectionState = value;
        };

        adapter.updateConnectionInfo();

        expect(connectionState).to.equal(true);
    });

    it("retries registration for a configured device that is still unavailable", async () => {
        const calls = [];
        adapter.config = { devices: [{ enabled: true, ip: "192.0.2.10", name: "living-room" }] };
        adapter.devices = {};
        adapter.register = async (address, name) => {
            calls.push({ address, name });
            adapter.registrationRetryAt.set(address, Date.now() + 5 * 60 * 1000);
        };

        await adapter.retryMissingDevices();

        expect(calls).to.deep.equal([{ address: "192.0.2.10", name: "living-room" }]);
        expect(adapter.registrationRetryAt.has("192.0.2.10")).to.equal(true);
    });

    it("does not retry registration before the five-minute retry time", async () => {
        let calls = 0;
        adapter.config = { devices: [{ enabled: true, ip: "192.0.2.11", name: "bedroom" }] };
        adapter.devices = {};
        adapter.registrationRetryAt.set("192.0.2.11", Date.now() + 5 * 60 * 1000);
        adapter.register = async () => {
            calls++;
        };

        await adapter.retryMissingDevices();

        expect(calls).to.equal(0);
    });

    it("initializes ioBroker states when a missing device is registered again", async () => {
        const device = { name: "office", airconId: "aircon-3", airconAddress: "192.0.2.12" };
        let initialized = null;
        adapter.config = { devices: [{ enabled: true, ip: "192.0.2.12", name: "office" }] };
        adapter.devices = {};
        adapter.register = async () => {
            adapter.devices[device.airconId] = device;
        };
        adapter.initIOBStates = async registeredDevice => {
            initialized = registeredDevice;
        };

        await adapter.retryMissingDevices();

        expect(initialized).to.equal(device);
    });

    it("keeps a recovered device online when state initialization fails", async () => {
        const device = { name: "office", airconId: "aircon-3", airconAddress: "192.0.2.12", online: true };
        const errors = [];
        adapter.config = { devices: [{ enabled: true, ip: "192.0.2.12", name: "office" }] };
        adapter.devices = {};
        adapter.register = async () => {
            adapter.devices[device.airconId] = device;
        };
        adapter.initIOBStates = async () => {
            throw new Error("database unavailable");
        };
        adapter.log.error = message => errors.push(message);
        adapter.errorHandler = () => {
            throw new Error("State initialization must not mark a device offline");
        };

        await adapter.retryMissingDevices();

        expect(device.online).to.equal(true);
        expect(errors).to.have.lengthOf(1);
        expect(errors[0]).to.contain("database unavailable");
    });

    it("reports disconnected when no devices are enabled", () => {
        let connectionState;
        adapter.config = { devices: [{ enabled: false }, { enabled: false }] };
        adapter.devices = {};
        adapter.setState = (id, value, ack) => {
            expect(id).to.equal("info.connection");
            expect(ack).to.equal(true);
            connectionState = value;
        };

        adapter.updateConnectionInfo();

        expect(connectionState).to.equal(false);
    });

    it("reports disconnected when only some enabled devices are online", () => {
        let connectionState;
        adapter.config = { devices: [{ enabled: true }, { enabled: true }] };
        adapter.devices = {
            first: { online: true },
            second: { online: false },
        };
        adapter.setState = (_id, value) => {
            connectionState = value;
        };

        adapter.updateConnectionInfo();

        expect(connectionState).to.equal(false);
    });

    it("reports connected only when every enabled device is online", () => {
        let connectionState;
        adapter.config = { devices: [{ enabled: true }, { enabled: true }] };
        adapter.devices = {
            first: { online: true },
            second: { online: true },
        };
        adapter.setState = (_id, value) => {
            connectionState = value;
        };

        adapter.updateConnectionInfo();

        expect(connectionState).to.equal(true);
    });

    it("keeps adapter connection online when one of multiple devices fails", () => {
        let connectionState;
        const first = { name: "first", airconId: "id-1", online: true };
        const second = { name: "second", airconId: "id-2", online: true };
        adapter.config = { devices: [{ enabled: true }, { enabled: true }] };
        adapter.devices = { first, second };
        adapter.setState = (id, value) => {
            if (id === "info.connection") {
                connectionState = value;
            }
        };
        adapter.log.error = () => {};

        adapter.errorHandler(first, "simulated connection failure");

        expect(first.online).to.equal(false);
        expect(second.online).to.equal(true);
        expect(connectionState).to.equal(false);
    });

    it("preserves the global retry configuration for normal requests", async () => {
        await adapter._postConnection({ address: "192.0.2.30", useHttps: false }, "getAirconStat");

        expect(axiosCalls).to.have.lengthOf(1);
        expect(axiosCalls[0][2]).not.to.have.property("axios-retry");
        expect(configuredRetryOptions).to.include({
            retries: 4,
            shouldResetTimeout: true,
        });
        expect(configuredRetryOptions.retryCondition).to.be.a("function");
        expect(configuredRetryOptions.retryDelay).to.be.a("function");
    });

    it("explicitly disables retries only for device detection requests", async () => {
        await adapter._postConnection(
            { address: "192.0.2.31", useHttps: false },
            "getDeviceInfo",
            undefined,
            { disableRetry: true },
        );

        expect(axiosCalls).to.have.lengthOf(1);
        expect(axiosCalls[0][2]["axios-retry"]).to.deep.equal({ retries: 0 });
        expect(configuredRetryOptions.retries).to.equal(4);
    });

    it("retries transient failures only for read-only device commands", () => {
        const readRequest = {
            config: {
                data: JSON.stringify({ command: "getAirconStat" }),
            },
        };
        const writeRequest = {
            config: {
                data: JSON.stringify({ command: "setAirconStat" }),
            },
        };

        expect(adapter.shouldRetryRequest(readRequest)).to.equal(true);
        expect(
            adapter.shouldRetryRequest({
                ...readRequest,
                response: { status: 503 },
            }),
        ).to.equal(true);
        expect(
            adapter.shouldRetryRequest({
                ...readRequest,
                response: { status: 501 },
            }),
        ).to.equal(false);
        expect(
            adapter.shouldRetryRequest({
                ...readRequest,
                response: { status: 400 },
            }),
        ).to.equal(false);
        expect(adapter.shouldRetryRequest(writeRequest)).to.equal(false);
    });

    it("does not retry requests with an unknown or malformed command", () => {
        expect(adapter.shouldRetryRequest({ config: { data: "{invalid-json" } })).to.equal(false);
        expect(adapter.shouldRetryRequest({ config: { data: JSON.stringify({ command: "unknown" }) } })).to.equal(
            false,
        );
        expect(adapter.shouldRetryRequest({})).to.equal(false);
    });

    it("returns false when a device rejects a write command", async () => {
        const errors = [];
        const device = {
            name: "room",
            airconId: "id-1",
            airconStat: {},
            acCoder: {
                toBase64: () => "encoded-status",
                fromBase64: () => {
                    throw new Error("must not decode rejected response");
                },
            },
        };
        adapter._postConnection = async () => ({ response: { result: 9 } });
        adapter.errorHandler = (_device, error) => errors.push(error);

        const sent = await adapter.sendDataToDevice(device);

        expect(sent).to.equal(false);
        expect(errors).to.have.lengthOf(1);
        expect(errors[0]).to.contain("result: 9");
    });

    it("restores the last confirmed value when a device rejects a state write", async () => {
        const device = {
            name: "room",
            airconId: "id-1",
            airconStat: { operation: false },
        };
        let published = false;
        adapter.devices = { [device.airconId]: device };
        adapter.getObjectAsync = async () => ({
            native: { airconId: device.airconId },
        });
        adapter.sendDataToDevice = async () => false;
        adapter.setIOBStates = async () => {
            published = true;
        };

        await adapter.setStateVal("mhi-wfrac.0.room.power", { val: true });

        expect(device.airconStat.operation).to.equal(false);
        expect(published).to.equal(false);
        expect(adapter.deviceCommandQueues.has(device.airconId)).to.equal(false);
    });

    it("returns true when a device accepts a write command", async () => {
        let decoded = false;
        const device = {
            name: "room",
            airconId: "id-1",
            airconStat: {},
            acCoder: {
                toBase64: () => "encoded-status",
                fromBase64: () => {
                    decoded = true;
                },
            },
        };
        adapter._postConnection = async () => ({
            response: { result: 0, contents: { airconStat: "returned-status" } },
        });

        const sent = await adapter.sendDataToDevice(device);

        expect(sent).to.equal(true);
        expect(decoded).to.equal(true);
    });

    it("rejects device responses with a non-zero or missing result code", () => {
        expect(() => adapter.assertSuccessfulResponse({ result: 0 }, "testCommand")).not.to.throw();
        expect(() => adapter.assertSuccessfulResponse({ result: 5 }, "testCommand")).to.throw(
            "testCommand was rejected by the device (result: 5)",
        );
        expect(() => adapter.assertSuccessfulResponse({}, "testCommand")).to.throw(
            "testCommand was rejected by the device (result: undefined)",
        );
    });

    it("does not decode aircon status when the device rejects a read command", async () => {
        const errors = [];
        let decodeCalled = false;
        const device = {
            name: "room",
            airconId: "id-1",
            acCoder: {
                fromBase64: () => {
                    decodeCalled = true;
                },
            },
        };
        adapter._postConnection = async () => ({ response: { result: 7 } });
        adapter.errorHandler = (_device, error) => errors.push(error);

        await adapter.getDataFromDevice(device);

        expect(decodeCalled).to.equal(false);
        expect(errors).to.have.lengthOf(1);
        expect(errors[0]).to.contain("result: 7");
    });

    it("does not decode aircon status when the device rejects a write command", async () => {
        const errors = [];
        let decodeCalled = false;
        const device = {
            name: "room",
            airconId: "id-1",
            airconStat: {},
            acCoder: {
                toBase64: () => "encoded-status",
                fromBase64: () => {
                    decodeCalled = true;
                },
            },
        };
        adapter._postConnection = async () => ({ response: { result: 9 } });
        adapter.errorHandler = (_device, error) => errors.push(error);

        await adapter.sendDataToDevice(device);

        expect(decodeCalled).to.equal(false);
        expect(errors).to.have.lengthOf(1);
        expect(errors[0]).to.contain("result: 9");
    });

    it("ignores a state change when its device is no longer registered", async () => {
        adapter.devices = {};
        adapter.getObjectAsync = async () => ({
            native: {
                airconId: "missing-device",
            },
        });

        await expect(
            adapter.setStateVal("mhi-wfrac.0.room.power", {
                val: true,
            }),
        ).to.be.fulfilled;
    });


    it("keeps a device online for the first two consecutive polling failures", async () => {
        const device = {
            name: "room",
            airconId: "id-poll-tolerance",
            online: true,
            pollFailureCount: 0,
            acCoder: { fromBase64: () => {} },
        };
        const errors = [];
        const debug = [];
        adapter._postConnection = async () => {
            throw new Error("temporary WiFi interruption");
        };
        adapter.errorHandler = (_device, error) => errors.push(error);
        adapter.log.debug = message => debug.push(message);

        await adapter.getDataFromDevice(device);
        expect(device.online).to.equal(true);
        expect(device.pollFailureCount).to.equal(1);
        expect(errors).to.have.lengthOf(0);

        await adapter.getDataFromDevice(device);
        expect(device.online).to.equal(true);
        expect(device.pollFailureCount).to.equal(2);
        expect(errors).to.have.lengthOf(0);
        expect(debug).to.have.lengthOf(2);
    });

    it("marks a device offline only on the third consecutive polling failure", async () => {
        const device = {
            name: "room",
            airconId: "id-poll-threshold",
            online: true,
            pollFailureCount: 0,
        };
        const errors = [];
        adapter._postConnection = async () => {
            throw new Error("device unreachable");
        };
        adapter.errorHandler = (currentDevice, error) => {
            errors.push({ device: currentDevice, error });
            currentDevice.online = false;
        };

        await adapter.getDataFromDevice(device);
        await adapter.getDataFromDevice(device);
        expect(device.online).to.equal(true);
        expect(errors).to.have.lengthOf(0);

        await adapter.getDataFromDevice(device);
        expect(device.online).to.equal(false);
        expect(device.pollFailureCount).to.equal(3);
        expect(errors).to.have.lengthOf(1);
        expect(errors[0].device).to.equal(device);
        expect(errors[0].error).to.contain("after 3 failed polls");

        await adapter.getDataFromDevice(device);
        expect(errors).to.have.lengthOf(1);
    });

    it("resets the polling failure counter and reports recovery after a successful poll", async () => {
        const device = {
            name: "room",
            airconId: "id-poll-recovery",
            online: false,
            pollFailureCount: 3,
            acCoder: { fromBase64: () => {} },
        };
        const info = [];
        let connectionUpdates = 0;
        adapter._postConnection = async () => ({
            response: {
                result: 0,
                contents: { airconStat: "valid-status" },
            },
        });
        adapter.log.info = message => info.push(message);
        adapter.updateConnectionInfo = () => {
            connectionUpdates++;
        };

        await adapter.getDataFromDevice(device);

        expect(device.pollFailureCount).to.equal(0);
        expect(device.online).to.equal(true);
        expect(info).to.have.lengthOf(1);
        expect(info[0]).to.contain("reachable again after 3 failed polls");
        expect(connectionUpdates).to.equal(1);
    });

    it("keeps a reachable device online when publishing ioBroker states fails", async () => {
        const device = {
            name: "room",
            airconId: "id-state-publish",
            online: true,
            airconStat: { operation: false },
        };
        const publishedStates = [];
        const handledErrors = [];
        const loggedErrors = [];
        adapter.setState = async id => {
            publishedStates.push(id);
            throw new Error("database unavailable");
        };
        adapter.errorHandler = (currentDevice, error) => handledErrors.push({ device: currentDevice, error });
        adapter.log.error = message => loggedErrors.push(message);

        await adapter.setIOBStates(device);

        expect(publishedStates).to.deep.equal(["id-state-publish.power"]);
        expect(device.online).to.equal(true);
        expect(handledErrors).to.have.lengthOf(0);
        expect(loggedErrors).to.have.lengthOf(1);
        expect(loggedErrors[0]).to.contain("database unavailable");
        expect(loggedErrors[0]).to.contain("AirconStat");
    });

    it("continues polling other devices after one device update throws", async () => {
        const first = { name: "first", airconId: "id-1" };
        const second = { name: "second", airconId: "id-2" };
        const updatedDevices = [];
        const handledErrors = [];
        let scheduledDelay;

        adapter.devices = { first, second };
        adapter.config = { interval: 20 };
        adapter.getDataFromDevice = async device => {
            if (device === first) {
                throw new Error("simulated polling failure");
            }
            updatedDevices.push(device);
        };
        adapter.setIOBStates = async device => updatedDevices.push(device);
        adapter.errorHandler = (device, error) => handledErrors.push({ device, error });
        adapter.updateConnectionInfo = () => {};
        adapter.setTimeout = (_callback, delay) => {
            scheduledDelay = delay;
            return 123;
        };

        await adapter.update();

        expect(handledErrors).to.have.lengthOf(1);
        expect(handledErrors[0].device).to.equal(first);
        expect(handledErrors[0].error).to.contain("simulated polling failure");
        expect(updatedDevices).to.deep.equal([second, second]);
        expect(scheduledDelay).to.equal(20000);
    });

    it("does not schedule another polling cycle after unload", async () => {
        let finishRequest;
        let scheduled = false;
        const device = { name: "room", airconId: "id-1" };

        adapter.devices = { room: device };
        adapter.config = { interval: 20 };
        adapter.getDataFromDevice = () =>
            new Promise(resolve => {
                finishRequest = resolve;
            });
        adapter.setIOBStates = async () => {};
        adapter.updateConnectionInfo = () => {};
        adapter.setTimeout = () => {
            scheduled = true;
            return 123;
        };
        adapter.clearTimeout = () => {};
        adapter.setOnlineState = () => {};
        adapter.setState = () => {};

        const updatePromise = adapter.update();
        await Promise.resolve();

        let unloadCallbackCalled = false;
        adapter.onUnload(() => {
            unloadCallbackCalled = true;
        });
        finishRequest();
        await updatePromise;

        expect(unloadCallbackCalled).to.equal(true);
        expect(adapter.unloading).to.equal(true);
        expect(scheduled).to.equal(false);
    });

    it("catches errors raised while processing a subscribed state change", async () => {
        const loggedErrors = [];
        adapter.log.error = message => loggedErrors.push(message);
        adapter.setStateVal = async () => {
            throw new Error("simulated state write failure");
        };

        await adapter.onStateChange("mhi-wfrac.0.room.power", {
            val: true,
            ack: false,
        });

        expect(loggedErrors).to.have.lengthOf(1);
        expect(loggedErrors[0]).to.contain("mhi-wfrac.0.room.power");
        expect(loggedErrors[0]).to.contain("simulated state write failure");
    });
});
