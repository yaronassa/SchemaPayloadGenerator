import {ISchemaPayloadGeneratorOptions, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';

const sinon = require('sinon');
const path = require('path');
const testDataPath = path.resolve('test', 'testData');

// tslint:disable:no-console

describe('SchemaPayloadGenerator Reports to STDOUT', () => {
    beforeEach(() => {
        sinon.spy(console, 'log');
    });

    afterEach(() => {
        // @ts-ignore
        console.log.restore();
    });

    describe('Schema loading', () => {

        it('Reports the correct loaded definition count (> 0)', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            // @ts-ignore
            await generator.loadSchema({definitions: {some: {}, else: {}}, junk: {}});
            expect(console.log).to.have.been.calledWith('Loaded schema with 2 definitions');
        });

        it('Reports the correct loaded definition count (= 0)', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            // @ts-ignore
            await generator.loadSchema({junk: {}, type: "string"});
            expect(console.log).to.have.been.calledWithMatch(/Loaded schema with 0 definitions/);
        });

        it('Reports direct objects', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            // @ts-ignore
            await generator.loadSchema({junk: {}, type: "string"});
            expect(console.log).to.have.been.calledWithMatch(/, and a direct object/);
        });

    });

});

