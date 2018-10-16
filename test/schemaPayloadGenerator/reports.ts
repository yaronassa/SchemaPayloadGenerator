import {ISchemaPayloadGeneratorOptions, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';

const sinon = require('sinon');
const path = require('path');
const testDataPath = path.resolve('test', 'testData');

// tslint:disable:no-console

describe('SchemaPayloadGenerator Reports to STDOUT', () => {
    beforeEach(() => {
        sinon.spy(process.stdout, 'write');
    });

    afterEach(() => {
        // @ts-ignore
        process.stdout.write.restore();
    });

    describe('Schema loading', () => {

        it('Reports the correct loaded definition count (> 0)', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            // @ts-ignore
            await generator.loadSchema({definitions: {some: {}, else: {}}, junk: {}});
            expect(process.stdout.write).to.have.been.calledWith('Loaded schema with 2 definitions\n');
        });

        it('Reports the correct loaded definition count (= 0)', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            // @ts-ignore
            await generator.loadSchema({junk: {}, type: "string"});
            expect(process.stdout.write).to.have.been.calledWithMatch(/Loaded schema with 0 definitions/);
        });

        it('Reports direct objects', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            // @ts-ignore
            await generator.loadSchema({junk: {}, type: "string"});
            expect(process.stdout.write).to.have.been.calledWithMatch(/, and a direct object/);
        });

    });

});

