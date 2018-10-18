import {SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {it, describe} from 'mocha';

const expect = require('chai').expect;
const sinon = require('sinon');

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

    describe('Generation reports', () => {
        beforeEach(() => {
            sinon.spy(process.stdout, 'write');
        });

        afterEach(() => {
            // @ts-ignore
            process.stdout.write.restore();
        });

        describe('Main object name', () => {
            it('Reports the definition key, if directly sent', async () => {
                const generator = new SchemaPayloadGenerator({silent: false});
                await generator.loadSchema({definitions: {some: {type: 'boolean', $id: 'my id', title: 'my title'}}});
                await generator.generatePayloads('some');
                expect(process.stdout.write).to.have.been.calledWithMatch(/Generating payloads for some/);
            });

            it('Reports the master node $id, if set', async () => {
                const generator = new SchemaPayloadGenerator({silent: false});
                await generator.loadSchema({type: 'boolean', $id: 'my id', title: 'my title'});
                await generator.generatePayloads();
                expect(process.stdout.write).to.have.been.calledWithMatch(/Generating payloads for my id/);
            });

            it('Reports the master node title, if set', async () => {
                const generator = new SchemaPayloadGenerator({silent: false});
                await generator.loadSchema({type: 'boolean', title: 'my title'});
                await generator.generatePayloads();
                expect(process.stdout.write).to.have.been.calledWithMatch(/Generating payloads for my title/);
            });

            it('Has a default if $id, title are not set', async () => {
                const generator = new SchemaPayloadGenerator({silent: false});
                await generator.loadSchema({type: 'boolean'});
                await generator.generatePayloads();
                expect(process.stdout.write).to.have.been.calledWithMatch(/Generating payloads for main object/);
            });
        });



    });
});

