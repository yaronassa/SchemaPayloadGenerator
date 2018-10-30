import {CountFieldProcessor} from "../../src/schemaFieldProcessors/countFieldProcessor";
import {it, describe} from 'mocha';
import {IFieldPossiblePayload, IFieldProcessingData, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {JSONSchema6} from "json-schema";

const expect = require('chai').expect;

class DemoFieldProcessor extends CountFieldProcessor {
    protected async processSchemaField_boolean(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const rawValues = [true];

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    protected async calculateSchemaFieldCount_boolean(field: IFieldProcessingData): Promise<number> {
        return 1;
    }

}

describe('CountFieldProcessor', () => {

    it('Must be initialized with an argument', () => {
        expect(() => {
            // @ts-ignore
            const countFieldProcessor = new CountFieldProcessor();
        }).to.throw('Must initialize with the calling value generator');
    });

    it('Can be inherited and expanded', () => {
        expect(() => {
            // @ts-ignore
            const demoFieldProcessor = new DemoFieldProcessor({});
        }).not.to.throw();
    });

    describe('Performance', () => {
        it('Can be faster than generating the actual payloads', async () => {
            const generator = new SchemaPayloadGenerator({combinations: {objects: {maxObjectPayloadCombinations: 50000}}});
            const schema = {type: 'object', properties : {}} as JSONSchema6;
            for (let i = 0; i < 20; i++) {
                schema.properties[i] = {type: 'boolean'};
            }
            await generator.loadSchema(schema);

            let start = Date.now();
            await generator.generatePayloads();
            const generationDuration = Date.now() - start;

            start = Date.now();
            await generator.calculatePayloadCount();
            const calculationDuration = Date.now() - start;

            expect(generationDuration).to.be.above(calculationDuration);
        });

        it('Can count non-feasible generation schemas ', async () => {
            const generator = new SchemaPayloadGenerator();
            const schema = {type: 'object', properties : {}} as JSONSchema6;
            for (let i = 0; i < 50; i++) {
                schema.properties[i] = {type: 'boolean'};
            }

            for (let i = 50; i < 100; i++) {
                schema.properties[i] = {
                    type: 'object', anyOf: [
                        {type: 'object', properties: {some: {type: 'boolean'}, thing: {type: 'boolean'}}},
                        {type: 'object', properties: {other: {type: 'boolean'}, another: {type: 'boolean'}}}
                    ]
                };
            }
            await generator.loadSchema(schema);

            const start = Date.now();
            await generator.calculatePayloadCount();
            const calculationDuration = Date.now() - start;

            expect(calculationDuration).to.be.below(1000);
        });
    });

    describe('Ill defined schemas', () => {
        // @ts-ignore
        const countFieldProcessor = new CountFieldProcessor({report: () => {}, options: {customTypeProcessors: {}, combinations: {objects: {}}}});

        it('Correctly identifies typeless enum fields', async () => {
           const result = await countFieldProcessor.calculateFieldPayloadCount({schema: {enum: [1, 2]}});
           expect(result).to.equal(2);
        });

        it('Correctly identifies typeless object fields', async () => {
            const result = await countFieldProcessor.calculateFieldPayloadCount({schema: {properties: {}}});
            expect(result).to.equal(1);
        });

        it('Cant process fields with unidentified types', async () => {
            await expect(countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'something'}}))
                .to.rejectedWith('Could not find a count handler for something');

            await expect(countFieldProcessor.calculateFieldPayloadCount({schema: {format: 'something'}}))
                .to.rejectedWith('Could not find a count handler for undefined');
        });

    });

    describe('Single value calculation', () => {
        // @ts-ignore
        const countFieldProcessor = new CountFieldProcessor({report: () => {}, options: {customTypeProcessors: {}}});

        describe('Boolean payload count calculation', () => {
            it('Correctly calculates payload count for boolean fields', async () => {
                const result = await countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'boolean'}});

                expect(result).to.equal(2);
            });

        });

        describe('Number payload count calculation', () => {
            it('Calculates payload count integer, number values', async () => {
                let result = await countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'integer'}});
                expect(result).to.equal(3);

                result = await countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'number'}});
                expect(result).to.equal(3);
            });

            it('Calculates payload count correctly if number options are provided', async () => {
                const result = await countFieldProcessor.calculateFieldPayloadCount({
                    schema: {
                        type: 'integer',
                        minimum: 5,
                        maximum: 8,
                        exclusiveMinimum: true,
                        exclusiveMaximum: true
                    }
                });
                expect(result).to.equal(3);
            });
        });

        describe('String payload count calculation', () => {
            it('Counts payloads for standard string', async () => {
                const result = await countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'string'}});
                expect(result).to.equal(1);
            });

            it('Handles calculating enum payload count', async () => {
                const result = await countFieldProcessor.calculateFieldPayloadCount({
                    schema: {
                        type: 'string',
                        enum: ['a', 'b', 'c', 1]
                    }
                });
                expect(result).to.equal(4);
            });

        });
    });
    describe('Complex payload count calculations', () => {

        const generatorStub = { report: () => {}, generateFieldPayloads: {}, calculateFieldPayloadCount: {}, options: {
                payloadKeyTransform: source => source.toLowerCase(), customTypeProcessors: {}, combinations: {arrays: {}, objects: {}}}
        };

        // @ts-ignore
        const countFieldProcessor = new CountFieldProcessor(generatorStub);
        generatorStub.generateFieldPayloads = countFieldProcessor.generateFieldPayloads.bind(countFieldProcessor);
        generatorStub.calculateFieldPayloadCount = countFieldProcessor.calculateFieldPayloadCount.bind(countFieldProcessor);

        describe('Array payload count calculations', () => {
            it('Calculate array payload count according to sub-type', async () => {
                const typesToCheck = ['string', 'boolean', 'number'];

                for (const typeToCheck of typesToCheck) {
                    const result = await countFieldProcessor.generateFieldPayloads({schema: {type: 'array', items: {type: typeToCheck}}});
                    const countResult = await countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'array', items: {type: typeToCheck}}});
                    expect(countResult).to.equal(result.length);
                }
            });

            it('Calculate correctly pairwise combination count for simple values', async () => {
                const field = {schema: {type: 'array', items: {type: 'string', enum: [1, 2, 3, 4, 5, 6]}}};
                const result = await countFieldProcessor.generateFieldPayloads(field);
                const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                expect(countResult).to.equal(result.length);
            });

            it('Calculate correctly pairwise combination count for object types', async () => {
                const field = { schema: {type: 'array', items: {type: 'object', required: ['some'], properties: {some: {type: 'boolean'}}}} };
                const result = await countFieldProcessor.generateFieldPayloads(field);
                const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                expect(countResult).to.equal(result.length);
            });
        });

        describe('Object values', () => {
            it('Calculates a complete combination spread of all the fields', async () => {
                const field = {schema: {type: 'object', required: ['some'], properties: {some: {type: 'boolean'}, thing: {type: 'integer'}, other: {type: 'string'}}}};
                const result = await countFieldProcessor.generateFieldPayloads(field);

                const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                expect(countResult).to.equal(result.length);
            });

            it('Can handle nested objects', async () => {
                const field = {schema: {type: 'object', properties: {some: {type: 'object', properties: {thing: {type: 'integer'}, other: {type: 'string'}}}}}};

                const result = await countFieldProcessor.generateFieldPayloads(field);
                const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                expect(countResult).to.equal(result.length);
            });

            describe('oneOf modifier', () => {
                it('Can handle oneOf modifier', async () => {
                    const field = {
                        schema: {type: 'object', oneOf: [
                                {properties: {some: {type: 'boolean'}}},
                                {properties: {thing: {type: 'boolean'}}}
                            ]
                        }};

                    const result = await countFieldProcessor.generateFieldPayloads(field);
                    const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                    expect(countResult).to.equal(result.length);
                });

                it('oneOf modifier respects the required field', async () => {
                    const field = {
                        schema: {type: 'object', oneOf: [
                                {properties: {some: {type: 'boolean'}}, required: ['some']},
                                {properties: {thing: {type: 'boolean'}}, required: ['thing']}
                            ]
                        }};

                    const result = await countFieldProcessor.generateFieldPayloads(field);
                    const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                    expect(countResult).to.equal(result.length);
                });
            });

            describe('allOf modifier', () => {
                it('Can handle allOf modifier', async () => {
                    const field = {
                        schema: {type: 'object', allOf: [
                                {properties: {some: {type: 'boolean'}}},
                                {properties: {thing: {type: 'boolean'}}}
                            ]
                        }};

                    const result = await countFieldProcessor.generateFieldPayloads(field);
                    const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                    expect(countResult).to.equal(result.length);
                });

                it('allOf modifier respects the required field', async () => {
                    const field = {
                        schema: {type: 'object', allOf: [
                                {properties: {some: {type: 'boolean'}}, required: ['some']},
                                {properties: {thing: {type: 'boolean'}}, required: ['thing']}
                            ]
                        }};

                    const result = await countFieldProcessor.generateFieldPayloads(field);
                    const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                    expect(countResult).to.equal(result.length);
                });
            });

            describe('anyOf modifier', () => {
                it('Can handle anyOf modifier', async () => {
                    const field = {
                        schema: {type: 'object', anyOf: [
                                {properties: {some: {type: 'boolean'}}},
                                {properties: {thing: {type: 'boolean'}}}
                            ]
                        }};

                    const result = await countFieldProcessor.generateFieldPayloads(field);
                    const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                    expect(countResult).to.equal(result.length);
                });

                it('Correctly handle required modifier', async () => {
                    const field = {
                        schema: {type: 'object', anyOf: [
                                {properties: {some: {type: 'boolean'}, another: {type: 'string', enum: '1'}}, required: ['another']},
                                {properties: {thing: {type: 'boolean'}}}
                            ]
                        }};

                    const result = await countFieldProcessor.generateFieldPayloads(field);
                    const countResult = await countFieldProcessor.calculateFieldPayloadCount(field);
                    expect(countResult).to.equal(result.length);
                });
            });
        });

    });

    describe('Customizations', () => {
        it('Can be inherited and modified', async () => {
            // @ts-ignore
            const demoFieldProcessor = new DemoFieldProcessor({options: {customTypeProcessors: {}}});

            const result = await demoFieldProcessor.generateFieldPayloads({schema: {type: 'boolean'}});
            const resultCount = await demoFieldProcessor.calculateFieldPayloadCount({schema: {type: 'boolean'}});

            expect(resultCount).to.equal(result.length);
        });

        it('Respects customTypeProcessors modifications when counting payload possibilities', async () => {
            // @ts-ignore
            const countFieldProcessor = new CountFieldProcessor({options: {customTypeProcessors: {boolean: async () => [false], string: async () => ['worked', 'well']}}});

            let result = await countFieldProcessor.generateFieldPayloads({schema: {type: 'boolean'}});
            let resultCount = await countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'boolean'}});
            expect(resultCount).to.equal(result.length);

            result = await countFieldProcessor.generateFieldPayloads({schema: {type: 'string'}});
            resultCount = await countFieldProcessor.calculateFieldPayloadCount({schema: {type: 'string'}});
            expect(resultCount).to.equal(result.length);

        });

        it('Respects CustomFieldProcessors modifications when counting payload possibilities', async () => {
            const myFunction = () => 'worked';
            // @ts-ignores
            const generator = new SchemaPayloadGenerator({customFieldProcessors: [myFunction]});
            await generator.loadSchema({type: 'boolean'});
            const result = await generator.generatePayloads();
            const resultCount = await generator.calculatePayloadCount();

            expect(resultCount).to.equal(result.length);
        });

        describe('Limit array combinations', () => {
            it('Respects simple maximum limit on array combinations', async () => {
                const generator = new SchemaPayloadGenerator({combinations: {arrays: {maxCombinations: 10}}});
                await generator.loadSchema({type: 'array', items: {type: 'string', enum: [1, 2, 3, 4, 5, 6]}});
                const result = await generator.generatePayloads();
                const resultCount = await generator.calculatePayloadCount();

                expect(resultCount).to.equal(result.length);
            });

            it('Respects using a custom combination generation function', async () => {
                const customCombinationGenerator = (field: IFieldProcessingData, subFieldRawValues: any[]): any[][] => {
                    return subFieldRawValues.reverse().map(item => [item]);
                };

                const generator = new SchemaPayloadGenerator({combinations: {arrays: {combinationGenerator: customCombinationGenerator}}});
                await generator.loadSchema({type: 'array', items: {type: 'string', enum: [1, 2, 3, 4, 5, 6]}});
                const result = await generator.generatePayloads();
                const resultCount = await generator.calculatePayloadCount();

                expect(resultCount).to.equal(result.length);
            });
        });

        describe('Limit object combinations', () => {
            it('Respects a simple maximum limit on object property combinations', async () => {
                const generator = new SchemaPayloadGenerator({combinations: {objects: {maxPropertiesCombinations: 1}}});
                await generator.loadSchema({type: 'object', properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                const resultCount = await generator.calculatePayloadCount();

                expect(resultCount).to.equal(result.length);
            });

            it('Respect a simple maximum limit on the total combinations an object can have', async () => {

                const generator = new SchemaPayloadGenerator({combinations: {objects: {maxObjectPayloadCombinations: 1}}});
                await generator.loadSchema({type: 'object', properties: {some: {type: 'boolean'}, thing: {type: 'string'}}});
                const result = await generator.generatePayloads();
                const resultCount = await generator.calculatePayloadCount();

                expect(resultCount).to.equal(result.length);
            });

            it('Respects generating object minimal payloads with a custom function', async () => {
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
                const resultCount = await generator.calculatePayloadCount();

                expect(resultCount).to.equal(result.length);
            });


            it('Respects generating object non-mandatory payloads with a custom function', async () => {
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
                const resultCount = await generator.calculatePayloadCount();

                expect(resultCount).to.equal(result.length);
            });

        });


    });

});

