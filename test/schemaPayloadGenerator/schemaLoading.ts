import {SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';

const path = require('path');
const testPathData = path.resolve('test', 'testData');

const sinon = require('sinon');

describe('SchemaPayloadGenerator Basic Schema loading', () => {

    describe('Invalid schemas', () => {
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
    });

    describe('Valid schemas', () => {
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

    describe('Schema loading reports', () => {

        beforeEach(() => {
            sinon.spy(process.stdout, 'write');
        });

        afterEach(() => {
            // @ts-ignore
            process.stdout.write.restore();
        });


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

