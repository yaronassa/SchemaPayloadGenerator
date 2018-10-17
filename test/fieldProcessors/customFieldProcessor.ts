import {CustomFieldProcessor} from "../../src/schemaFieldProcessors/customFieldProcessor";
import {expect} from 'chai';
import {it, describe} from 'mocha';
import {IFieldPossiblePayload, IFieldProcessingData, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {TypeFieldProcessor} from "../../src/schemaFieldProcessors/typeFieldProcessor";

const path = require('path');
const testDataPath = path.resolve('test', 'testData');

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
    });
});

