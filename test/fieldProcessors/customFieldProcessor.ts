import {CustomFieldProcessor} from "../../src/schemaFieldProcessors/customFieldProcessor";
import {it, describe} from 'mocha';
import {IFieldPossiblePayload, IFieldProcessingData, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";

const expect = require('chai').expect;

class DemoFieldProcessor extends CustomFieldProcessor {
    public async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        return undefined;
    }
}


describe('CustomFieldProcessor', () => {

    it('Must be initialized with an argument', () => {
        expect(() => {
            // @ts-ignore
            const customFieldProcessor = new CustomFieldProcessor();
        }).to.throw('Must initialize with the calling value generator');
    });

    it('Can be inherited and expanded', () => {
        expect(() => {
            // @ts-ignore
            const demoFieldProcessor = new DemoFieldProcessor({options: {}});
        }).not.to.throw();
    });

    describe('Processing functionality', () => {
        it('Can mask other processors', async () => {
           const generator = new SchemaPayloadGenerator({customFieldProcessors: async () => ['worked']});
           await generator.loadSchema({type: 'boolean'});

           const result = await generator.generatePayloads();

           expect(result.length).to.equal(1);
           expect(result[0].payload).to.equal('worked');
        });

        it('Supports multiple processors that can override one another', async () => {
            const processors = [
                async (field: IFieldProcessingData) => (field.schema.type === 'boolean') ? [false] : undefined,
                async (field: IFieldProcessingData) => (field.schema.title === 'override') ? [true] : undefined
            ];

            const generator = new SchemaPayloadGenerator({customFieldProcessors: processors});
            await generator.loadSchema({type: 'boolean'});
            let result = await generator.generatePayloads();

            expect(result[0].payload).to.equal(false);

            await generator.loadSchema({type: 'boolean', title: 'override'});

            result = await generator.generatePayloads();
            expect(result[0].payload).to.equal(true);
        });

        it('Transforms single raw value result into an array', async () => {
            // @ts-ignore
            const generator = new SchemaPayloadGenerator({customFieldProcessors: async () => 'worked'});
            await generator.loadSchema({type: 'boolean'});

            const result = await generator.generatePayloads();

            expect(result.length).to.equal(1);
            expect(result[0].payload).to.equal('worked');
        });

        it('Works for nested values', async () => {
            // @ts-ignore
            const generator = new SchemaPayloadGenerator({customFieldProcessors: async (field: IFieldProcessingData) => {
                    if (field.schema.type === 'boolean') return 'worked';
                }});
            await generator.loadSchema({type: 'object', properties: {some: {type: 'boolean'}}, required: ['some']});
            const result = await generator.generatePayloads();

            expect(result[0].payload.some).to.equal('worked');
        });
    });
});

