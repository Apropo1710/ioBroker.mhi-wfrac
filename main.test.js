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
