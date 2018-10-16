import {ISchemaPayloadGeneratorOptions, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';

const sinon = require('sinon');
const path = require('path');
const testDataPath = path.resolve('test', 'testData');

describe('SchemaPayloadGenerator Options', () => {
    beforeEach(() => {
        sinon.spy(process.stdout, 'write');
    });

    afterEach(() => {
        // @ts-ignore
        process.stdout.write.restore();
    });

    describe('Silent option', () => {
        it('Suppresses schema loading messages', async () => {
            const generator = new SchemaPayloadGenerator({silent: true});
            await generator.loadSchema({definitions: {some: {}}});
            expect(process.stdout.write).to.have.callCount(0);
        });

        it('Defaults to true', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {some: {}}});
            expect(process.stdout.write).to.have.callCount(0);
        });

        it('Can be switched on', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            await generator.loadSchema({definitions: {some: {}}});
            expect(process.stdout.write).to.have.been.calledWithMatch(/Loaded schema/);
        });
    });

});

