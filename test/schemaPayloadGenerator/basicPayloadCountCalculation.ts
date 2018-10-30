import {SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {it, describe} from 'mocha';

const expect = require('chai').expect;
const sinon = require('sinon');

describe('SchemaPayloadGenerator Basic Payload Count Calculation', () => {

    describe('Calculation Errors', () => {
        it('Cannot calculate payload count without loading a schema', async () => {
            const generator = new SchemaPayloadGenerator();
            await expect(generator.calculatePayloadCount('')).to.rejectedWith('Must load a schema before generating payloads');
        });

        it('Cannot calculate payload count when master object does not have the type property', async () => {
            const generator = new SchemaPayloadGenerator();
            // @ts-ignore
            await generator.loadSchema({some: {prop: 'value'}});
            await expect(generator.calculatePayloadCount()).to.rejectedWith(`Schema root doesn't have the mandatory "type" property`);
            // @ts-ignore
            await generator.loadSchema({definitions: {some: {prop: 'value'}}});
            await expect(generator.calculatePayloadCount('some')).to.rejectedWith(`Schema root doesn't have the mandatory "type" property`);

        });

        it('Cannot calculate payload count for a definition-only schema, without specifying a type', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {}});
            await expect(generator.calculatePayloadCount()).to.rejectedWith('Must specify a definition for a definition-only schema');
        });

        it('Cannot calculate payload count for a non-existent definition', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {}});
            await expect(generator.calculatePayloadCount('def')).to.rejectedWith('Cannot find definition with key = def');
        });
    });

    describe('Calculation reports', () => {
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
                await generator.calculatePayloadCount('some');
                expect(process.stdout.write).to.have.been.calledWithMatch(/Calculating payload count for some/);
            });

            it('Reports the master node $id, if set', async () => {
                const generator = new SchemaPayloadGenerator({silent: false});
                await generator.loadSchema({type: 'boolean', $id: 'my id', title: 'my title'});
                await generator.calculatePayloadCount();
                expect(process.stdout.write).to.have.been.calledWithMatch(/Calculating payload count for my id/);
            });

            it('Reports the master node title, if set', async () => {
                const generator = new SchemaPayloadGenerator({silent: false});
                await generator.loadSchema({type: 'boolean', title: 'my title'});
                await generator.calculatePayloadCount();
                expect(process.stdout.write).to.have.been.calledWithMatch(/Calculating payload count for my title/);
            });

            it('Has a default if $id, title are not set', async () => {
                const generator = new SchemaPayloadGenerator({silent: false});
                await generator.loadSchema({type: 'boolean'});
                await generator.calculatePayloadCount();
                expect(process.stdout.write).to.have.been.calledWithMatch(/Calculating payload count for main object/);
            });
        });



    });
});

