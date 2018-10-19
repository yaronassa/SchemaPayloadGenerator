import {TypeFieldProcessor} from "../../src/schemaFieldProcessors/typeFieldProcessor";
import {it, describe} from 'mocha';
import {IFieldPossiblePayload, IFieldProcessingData} from "../../src/schemaPayloadGenerator";
import {JSONSchema6} from "json-schema";

const expect = require('chai').expect;

class DemoFieldProcessor extends TypeFieldProcessor {
    protected async processSchemaField_boolean(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const rawValues = [true];

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

}

describe('TypeFieldProcessor', () => {

    it('Must be initialized with an argument', () => {
        expect(() => {
            // @ts-ignore
            const typeFieldProcessor = new TypeFieldProcessor();
        }).to.throw('Must initialize with the calling value generator');
    });

    it('Can be inherited and expanded', () => {
        expect(() => {
            // @ts-ignore
            const demoFieldProcessor = new DemoFieldProcessor({});
        }).not.to.throw();
    });

    describe('Ill defined schemas', () => {
        // @ts-ignore
        const typeFieldProcessor = new TypeFieldProcessor({report: () => {}, options: {customTypeProcessors: {}, combinations: {objects: {}}}});

        it('Correctly identifies typeless enum fields', async () => {
           const result = await typeFieldProcessor.generateFieldPayloads({schema: {enum: [1, 2]}});
           expect(result.map(item => item.payload).join(',')).to.equal('1,2');
        });

        it('Correctly identifies typeless object fields', async () => {
            const result = await typeFieldProcessor.generateFieldPayloads({schema: {properties: {}}});
            expect(result.map(item => JSON.stringify(item.payload)).join(',')).to.equal('{}');
        });

        it('Cant process fields with unidentified types', async () => {
            await expect(typeFieldProcessor.generateFieldPayloads({schema: {type: 'something'}}))
                .to.rejectedWith('Could not find a type handler for something');

            await expect(typeFieldProcessor.generateFieldPayloads({schema: {format: 'something'}}))
                .to.rejectedWith('Could not find a type handler for undefined');
        });

    });

    describe('Single value generation', () => {
        // @ts-ignore
        const typeFieldProcessor = new TypeFieldProcessor({report: () => {}, options: {customTypeProcessors: {}}});

        describe('Boolean values', () => {
            it('Correctly generates boolean values', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'boolean'}});

                const rawValues = result.map(fieldPayload => fieldPayload.payload);
                expect(JSON.stringify(rawValues)).to.equal('[true,false]');
            });

        });

        describe('Number values', () => {
            it('Generate integer, number values', async () => {
                let result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'integer'}});
                result.forEach(fieldPayload => expect(fieldPayload.payload).to.be.a('number'));

                result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'number'}});
                result.forEach(fieldPayload => expect(fieldPayload.payload).to.be.a('number'));
            });

            it('Defaults to max=100, min=1 if not specified', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'integer'}});
                expect(result.map(fieldPayload => fieldPayload.payload).join(',')).to.match(/^1,100,\d+$/);
            });

            it('Allows specifying min and max ranges', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {
                        type: 'integer',
                        minimum: 5,
                        maximum: 8
                    }
                });
                expect(result.map(fieldPayload => fieldPayload.payload).join(',')).to.match(/^5,8,[5678]$/);
            });

            it('Respects exclusiveMaximum, exclusiveMinimum', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {
                        type: 'integer',
                        minimum: 5,
                        maximum: 8,
                        exclusiveMinimum: true,
                        exclusiveMaximum: true
                    }
                });
                expect(result.map(fieldPayload => fieldPayload.payload).join(',')).to.match(/^6,7,[67]$/);
            });
        });

        describe('String values', () => {
            it('Generates standard string', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'string'}});
                result.forEach(fieldPayload => expect(fieldPayload.payload).to.be.a('string'));
            });

            it('Handles enum values', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {
                        type: 'string',
                        enum: ['a', 'b', 'c', 1]
                    }
                });
                expect(result.map(fieldPayload => fieldPayload.payload).join(',')).to.equal('a,b,c,1');
            });

            // string variations depend on https://github.com/json-schema-faker/json-schema-faker, no need to check them
        });
    });
    describe('Complex value generation', () => {

        // @ts-ignore
        const typeFieldProcessor = new TypeFieldProcessor({ report: () => {}, options: {
            payloadKeyTransform: source => source.toLowerCase(), customTypeProcessors: {}, combinations: {arrays: {}, objects: {}}}
        });

        describe('Array values', () => {
            it('Generates arrays according to sub-type', async () => {
                const typesToCheck = ['string', 'boolean', 'number'];
                const checkResultsType = (resultToCheck: IFieldPossiblePayload[], expectedType: string) => {
                    resultToCheck.forEach(fieldPayload => fieldPayload.payload.forEach(item => expect(item).to.be.a(expectedType)));
                };

                for (const typeToCheck of typesToCheck) {
                    const result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'array', items: {type: typeToCheck}}});
                    checkResultsType(result, typeToCheck);
                }
            });

            it('Generates pairwise combinations for simple values', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'array', items: {type: 'string', enum: [1, 2, 3, 4, 5, 6]}}});
                expect(result.length).to.equal(21);
                expect(result.map(item => item.payload.join(',')).join(';')).to.equal('1;2;3;4;5;6;1,2;1,3;1,4;1,5;1,6;2,3;2,4;2,5;2,6;3,4;3,5;3,6;4,5;4,6;5,6');
            });

            it('Does not create pairwise combinations for object types', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {type: 'array', items: {type: 'object', required: ['some'], properties: {some: {type: 'boolean'}}}}
                });
                expect(result.length).to.equal(2);
                expect(JSON.stringify(result.map(item => item.payload))).to.equal('[{"some":true},{"some":false}]');
            });
        });

        describe('Object values', () => {
            it('Includes required fields in all variations', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {type: 'object', required: ['some'], properties: {some: {type: 'boolean'}, thing: {type: 'integer'}, other: {type: 'string'}}}
                });

                expect(result.every(item => item.payload.some !== undefined)).to.equal(true);
            });

            it('Creates some variations without non-required fields', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {type: 'object', required: ['some'], properties: {some: {type: 'boolean'}, thing: {type: 'integer'}, other: {type: 'string'}}}
                });

                expect(result.some(item => item.payload.other === undefined)).to.equal(true);
                expect(result.some(item => item.payload.other !== undefined)).to.equal(true);
            });

            it('Creates a complete combination spread of all the fields', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {type: 'object', required: ['some'], properties: {some: {type: 'boolean'}, thing: {type: 'integer'}, other: {type: 'string'}}}
                });

                expect(result.length).to.equal(16); // = 2 boolean, 3 integer + undefined, 1 string + undefined = 2X4X2 = 16
            });

            it('Can handle nested objects', async () => {
                const result = await typeFieldProcessor.generateFieldPayloads({
                    schema: {type: 'object', properties: {some: {type: 'object', properties: {thing: {type: 'integer'}, other: {type: 'string'}}}}}
                });

                expect(result.length).to.equal(9);
                // Inner object: 3 integer + undefined, 1 string + undefined = 4*2 = 8; Outer object: The inner + undefined = 9
                expect(result.filter(item => item.payload.some !== undefined).some(item => item.payload.some.thing === 1)).to.equal(true);
            });

            describe('oneOf modifier', () => {
                it('Can handle oneOf modifier', async () => {
                    const result = await typeFieldProcessor.generateFieldPayloads({
                        schema: {type: 'object', oneOf: [
                            {properties: {some: {type: 'boolean'}}},
                            {properties: {thing: {type: 'boolean'}}}
                            ]
                    }});

                    expect(result.some(item => item.payload.some !== undefined)).to.equal(true);
                    expect(result.some(item => item.payload.thing !== undefined)).to.equal(true);
                    expect(result.every(item => item.payload.some === undefined || item.payload.thing === undefined)).to.equal(true);
                });

                it('oneOf modifier respects the required field', async () => {
                    const result = await typeFieldProcessor.generateFieldPayloads({
                        schema: {type: 'object', oneOf: [
                                {properties: {some: {type: 'boolean'}}, required: ['some']},
                                {properties: {thing: {type: 'boolean'}}, required: ['thing']}
                            ]
                        }});

                    expect(result.map(item => `${item.payload.some},${item.payload.thing}`).join(';'))
                        .to.equal('true,undefined;false,undefined;undefined,true;undefined,false');
                });
            });
        });

    });

    describe('Customizations', () => {
        it('Can be inherited and modified', async () => {
            // @ts-ignore
            const demoFieldProcessor = new DemoFieldProcessor({options: {customTypeProcessors: {}}});

            const result = await demoFieldProcessor.generateFieldPayloads({schema: {type: 'boolean'}});

            expect(result.length).to.equal(1);
            expect(result[0].payload).to.equal(true);
        });

        it('Can be overridden for specific types', async () => {
            // @ts-ignore
            const typeFieldProcessor = new TypeFieldProcessor({options: {customTypeProcessors: {boolean: async () => [false], string: async () => ['worked']}}});

            let result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'boolean'}});
            expect(result.length).to.equal(1);
            expect(result[0].payload).to.equal(false);

            result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'string'}});
            expect(result.length).to.equal(1);
            expect(result[0].payload).to.equal('worked');
        });

        it('Transforms single raw value result into an array', async () => {
            // @ts-ignore
            const typeFieldProcessor = new TypeFieldProcessor({options: {customTypeProcessors: {string: async () => 'single'}}});

            const result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'string'}});
            expect(result.length).to.equal(1);
            expect(result[0].payload).to.equal('single');
        });

        it('Specific type customizations get the field schema as a parameter', async () => {
            // @ts-ignore
            const typeFieldProcessor = new TypeFieldProcessor({options: {customTypeProcessors: {string: async (fieldSchema: JSONSchema6) => [fieldSchema.title]}}});

            const result = await typeFieldProcessor.generateFieldPayloads({schema: {type: 'string', title: 'myTitle'}});
            expect(result.length).to.equal(1);
            expect(result[0].payload).to.equal('myTitle');
        });
    });

});

