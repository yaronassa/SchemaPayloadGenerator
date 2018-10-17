import {ISchemaPayloadGeneratorOptions, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';
import {CustomFieldProcessor, CustomProcessorFunction} from "../../src/schemaFieldProcessors/customFieldProcessor";

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

    describe('CustomFieldProcessors option', () => {
        it('Defaults to an empty array', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {some: {}}});
            expect(generator.options.customFieldProcessors).to.deep.equal([]);
        });

        it('Turn single values to arrays', async () => {
            // @ts-ignore
            const generator = new SchemaPayloadGenerator({customFieldProcessors: true});
            expect(generator.options.customFieldProcessors).to.deep.equal([true]);
        });

        it('Can be set to a function array', async () => {
            const myFunciton = () => 'worked';
            // @ts-ignores
            const generator = new SchemaPayloadGenerator({customFieldProcessors: [myFunciton]});
            expect((generator.options.customFieldProcessors as CustomProcessorFunction[])[0].call(this)).to.equal('worked');
        });
    });

});

