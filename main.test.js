"use strict";

const { expect } = require("chai");
const EventEmitter = require("node:events");
const proxyquire = require("proxyquire").noCallThru();

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
});

describe("MHIWFRac state handling", () => {
    let adapter;

    beforeEach(() => {
        adapter = createAdapter({});
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
