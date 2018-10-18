import {
    IFieldPossiblePayload,
    IFieldProcessingData,
    SchemaPayloadGenerator
} from "../../src/schemaPayloadGenerator";

import {it, describe} from 'mocha';
import {CustomProcessorFunction} from "../../src/schemaFieldProcessors/customFieldProcessor";

const sinon = require('sinon');
const expect = require('chai').expect;

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

            it('Defaults to regular combination generation if a custom combination function return undefined', async () => {
                const customCombinationGenerator = (field: IFieldProcessingData, subFieldRawValues: any[]): any[][] => {
                    return undefined;
                };

                const generator = new SchemaPayloadGenerator({combinations: {arrays: {combinationGenerator: customCombinationGenerator}}});
                await generator.loadSchema({type: 'array', items: {type: 'string', enum: [1, 2, 3, 4, 5, 6]}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(21);
                expect(result.map(item => item.payload.join(',')).join(';')).to.equal('1;2;3;4;5;6;1,2;1,3;1,4;1,5;1,6;2,3;2,4;2,5;2,6;3,4;3,5;3,6;4,5;4,6;5,6');
            });
        });

        describe('Limit object combinations', () => {
            it('Can set a simple maximum limit on object property combinations', async () => {
                const generator = new SchemaPayloadGenerator({combinations: {objects: {maxPropertiesCombinations: 1}}});
                await generator.loadSchema({type: 'object', properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(4); // 1 from boolean + undefined + 1 from string + undefined
                expect(result.some(item => item.payload.some === undefined));
                expect(result.some(item => item.payload.thing === undefined));
            });

            it('Can set a simple maximum limit on the total combinations an object can have', async () => {

                const generator = new SchemaPayloadGenerator({combinations: {objects: {maxObjectPayloadCombinations: 1}}});
                await generator.loadSchema({type: 'object', properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(1);
            });

            it('Can generate object minimal payloads with a custom function', async () => {
                // tslint:disable-next-line:max-line-length
                const customMinimalPayloadCombinationGenerator = (objectField: IFieldProcessingData, requiredPropertiesPossibilities: {[key: string]: IFieldPossiblePayload[]}): any[] => {
                    const payload = {};
                    Object.keys(requiredPropertiesPossibilities).forEach(propertyKey => {
                        payload[propertyKey] = requiredPropertiesPossibilities[propertyKey][0].payload;
                    });
                    return [payload];
                };

                const generator = new SchemaPayloadGenerator({combinations: {objects: {minimalPayloadCombinationGenerator: customMinimalPayloadCombinationGenerator}}});
                await generator.loadSchema({type: 'object', required: ['some'], properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(2); // 1 from boolean, 1 string + undefined
                expect(result.every(item => item.payload.some === true));
            });

            it('Reverts to default behaviour when object minimal payloads custom function return undefined', async () => {
                const generator = new SchemaPayloadGenerator({combinations: {objects: {minimalPayloadCombinationGenerator: () => undefined}}});
                await generator.loadSchema({type: 'object', required: ['some'], properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(4); // 2 from boolean, 1 string + undefined = 4 total
            });

            it('Can generate object non-mandatory payloads with a custom function', async () => {
                // tslint:disable-next-line:max-line-length
                const customOptionalPayloadCombinationGenerator = (field: IFieldProcessingData, generatedMinimalPayloads: IFieldPossiblePayload[], optionalPropertiesPossibilities: {[key: string]: IFieldPossiblePayload[]}): any[] => {
                    const payload = {};
                    Object.keys(optionalPropertiesPossibilities).forEach(propertyKey => {
                        payload[propertyKey] = optionalPropertiesPossibilities[propertyKey][0].payload;
                    });

                    return [payload];
                };


                const generator = new SchemaPayloadGenerator({combinations: {objects: {optionalPayloadCombinationsGenerator: customOptionalPayloadCombinationGenerator}}});
                await generator.loadSchema({type: 'object', required: ['thing'], properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(2); // 1 from boolean + undefined, 1 string
            });

            it('Optional payloads custom function preserves parent-payload structure', async () => {
                // tslint:disable-next-line:max-line-length
                const customOptionalPayloadCombinationGenerator = (field: IFieldProcessingData, generatedMinimalPayloads: IFieldPossiblePayload[], optionalPropertiesPossibilities: {[key: string]: IFieldPossiblePayload[]}): any[] => {
                    const payload = {};
                    Object.keys(optionalPropertiesPossibilities).forEach(propertyKey => {
                        payload[propertyKey] = optionalPropertiesPossibilities[propertyKey][0].payload;
                    });

                    return [payload];
                };


                const generator = new SchemaPayloadGenerator({combinations: {objects: {optionalPayloadCombinationsGenerator: customOptionalPayloadCombinationGenerator}}});
                await generator.loadSchema({type: 'object', required: ['thing'], properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                const child = result.find(item => item.payload.some !== undefined);
                const parent = result.find(item => item.payload.some === undefined);
                expect(child.parentPossiblePayload).to.equal(parent);
            });

            it('Reverts to default behaviour when object optional payloads custom function return undefined', async () => {

                const generator = new SchemaPayloadGenerator({combinations: {objects: {optionalPayloadCombinationsGenerator: () => undefined}}});
                await generator.loadSchema({type: 'object', required: ['thing'], properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                expect(result.length).to.equal(3);
            });

        });



    });

});

