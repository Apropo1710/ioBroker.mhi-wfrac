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
