import {ISchemaPayloadGeneratorOptions, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';

const path = require('path');
const testDataPath = path.resolve('test', 'testData');


describe('SchemaPayloadGenerator Basic Payload Generation', () => {

    describe('Generation Errors', () => {
        it('Cannot generate payload without loading a schema', async () => {
            const generator = new SchemaPayloadGenerator();
            await expect(generator.generatePayloads('')).to.rejectedWith('Must load a schema before generating payloads');
        });

        it('Cannot generate payload when master object does not have the type property', async () => {
            const generator = new SchemaPayloadGenerator();
            // @ts-ignore
            await generator.loadSchema({some: {prop: 'value'}});
            await expect(generator.generatePayloads()).to.rejectedWith(`Schema root doesn't have the mandatory "type" property`);
            // @ts-ignore
            await generator.loadSchema({definitions: {some: {prop: 'value'}}});
            await expect(generator.generatePayloads('some')).to.rejectedWith(`Schema root doesn't have the mandatory "type" property`);

        });

        it('Cannot generate payload for a definition-only schema, without specifying a type', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {}});
            await expect(generator.generatePayloads()).to.rejectedWith('Must specify a definition for a definition-only schema');
        });

        it('Cannot generate payload for a non-existent definition', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {}});
            await expect(generator.generatePayloads('def')).to.rejectedWith('Cannot find definition with key = def');
        });
    });

});

