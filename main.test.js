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
