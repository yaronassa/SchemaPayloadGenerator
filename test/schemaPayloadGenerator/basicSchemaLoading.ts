import {SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';

const path = require('path');
const testPathData = path.resolve('test', 'testData');
import {it, describe} from 'mocha';

describe('SchemaPayloadGenerator Basic Schema loading', () => {

    it('Cannot call loadSchema without a schema option', async () => {
        const generator = new SchemaPayloadGenerator();
        // @ts-ignore
        await expect(generator.loadSchema()).to.rejectedWith('Must pass a schema object / path');
    });

    it('Cannot load a bad file path', async () => {
        const generator = new SchemaPayloadGenerator();
        await expect(generator.loadSchema('./doesntexist.json')).to.be.rejectedWith('Failed to read schema from location = ./doesntexist.json');
    });

    it('Cannot parse a bad schema with a bad ref', async () => {
        const generator = new SchemaPayloadGenerator();
        // @ts-ignore
        await expect(generator.loadSchema({bad: {$ref: '/some/thing'}})).to.be.rejectedWith(/Failed to parse schema: .+/);
        await expect(generator.loadSchema(path.resolve(testPathData, 'baseMockBADSchema.json'))).to.be.rejectedWith(/Failed to parse schema: .+/);
    });

    it('Can load an assumed schema object', async () => {
        const generator = new SchemaPayloadGenerator();
        await expect(generator.loadSchema({definitions: {some: {}}})).not.to.be.rejected;
        await expect(generator.loadSchema(path.resolve(testPathData, 'baseMockSchema.json'))).not.to.be.rejected;
    });

    it('Can load an full schema object', async () => {
        const generator = new SchemaPayloadGenerator();
        await expect(generator.loadSchema(path.resolve(testPathData, 'exampleSchema.json'))).not.to.be.rejected;
    });
});

