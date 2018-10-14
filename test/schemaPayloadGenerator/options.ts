import {ISchemaPayloadGeneratorOptions, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';

const sinon = require('sinon');
const path = require('path');
const testDataPath = path.resolve('test', 'testData');

// tslint:disable:no-console

describe('SchemaPayloadGenerator Options', () => {
    beforeEach(() => {
        sinon.spy(console, 'log');
    });

    afterEach(() => {
        // @ts-ignore
        console.log.restore();
    });

    describe('Silent option', () => {
        it('Suppresses schema loading messages', async () => {
            const generator = new SchemaPayloadGenerator({silent: true});
            await generator.loadSchema({definitions: {some: {}}});
            expect(console.log).to.have.callCount(0);
        });

        it('Defaults to true', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {some: {}}});
            expect(console.log).to.have.callCount(0);
        });

        it('Can be switched on', async () => {
            const generator = new SchemaPayloadGenerator({silent: false});
            await generator.loadSchema({definitions: {some: {}}});
            expect(console.log).to.have.been.calledWithMatch(/Loaded schema/);
        });
    });

});

