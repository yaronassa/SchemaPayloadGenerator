import {
    IFieldProcessingData,
    ISchemaPayloadGeneratorOptions,
    SchemaPayloadGenerator
} from "../../src/schemaPayloadGenerator";
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
            const myFunction = () => 'worked';
            // @ts-ignores
            const generator = new SchemaPayloadGenerator({customFieldProcessors: [myFunction]});
            expect((generator.options.customFieldProcessors as CustomProcessorFunction[])[0].call(this)).to.equal('worked');
        });
    });

    describe('CustomTypeProcessors option', () => {
        it('Defaults to an empty object', async () => {
            const generator = new SchemaPayloadGenerator();
            await generator.loadSchema({definitions: {some: {}}});
            expect(generator.options.customTypeProcessors).to.deep.equal({});
        });

        it('Can be set to an object with function value', async () => {
            const myFunction = () => 'worked';
            // @ts-ignores
            const generator = new SchemaPayloadGenerator({customTypeProcessors: {boolean: myFunction}});
            expect((generator.options.customTypeProcessors.boolean).call(this)).to.equal('worked');
        });
    });

    describe('Combinations options', () => {
        it('Defaults to an arrays, objects empty object', async () => {
            const generator = new SchemaPayloadGenerator();
            expect(generator.options.combinations).to.deep.equal({arrays: {}, objects: {}});
        });

        describe('Limit array combinations', () => {
            it('Can set a simple maximum limit on array combinations', async () => {
                const generator = new SchemaPayloadGenerator({combinations: {arrays: {maxCombinations: 10}}});
                await generator.loadSchema({type: 'array', items: {type: 'string', enum: [1, 2, 3, 4, 5, 6]}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(10);
                expect(result.map(item => item.payload.join(',')).join(';')).to.equal('1;2;3;4;5;6;1,2;1,3;1,4;1,5');
            });

            it('Can use a custom combination generation function', async () => {
                const customCombinationGenerator = (field: IFieldProcessingData, subFieldRawValues: any[]): any[][] => {
                    return subFieldRawValues.reverse().map(item => [item]);
                };

                const generator = new SchemaPayloadGenerator({combinations: {arrays: {combinationGenerator: customCombinationGenerator}}});
                await generator.loadSchema({type: 'array', items: {type: 'string', enum: [1, 2, 3, 4, 5, 6]}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(6);
                expect(result.map(item => item.payload.join(',')).join(';')).to.equal('6;5;4;3;2;1');
            });
        });


    });

});

