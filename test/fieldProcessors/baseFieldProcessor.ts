import {BaseFieldProcessor} from "../../src/schemaFieldProcessors/baseFieldProcessor";
import {expect} from 'chai';
import {it, describe} from 'mocha';
import {IFieldPossiblePayload, IFieldProcessingData} from "../../src/schemaPayloadGenerator";

const path = require('path');
const testDataPath = path.resolve('test', 'testData');

class DemoFieldProcessor extends BaseFieldProcessor {
    public async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        return undefined;
    }

    public getGeneratedID(fieldFullPath: string, index: number): string {
        // @ts-ignore
        return this.generatePayloadID({fieldFullPath}, index);
    }

    public getPossiblePayloads(rawValues: any[], fieldFullPath: string): IFieldPossiblePayload[] {
        // @ts-ignore
        return this.rawValuesToPossiblePayloads(rawValues, {fieldFullPath});
    }
}


describe('BaseFieldProcessor', () => {

    it('Must be initialized with an argument', () => {
        expect(() => {
            // @ts-ignore
            const demoFieldProcessor = new DemoFieldProcessor();
        }).to.throw('Must initialize with the calling value generator');
    });

    it('Cannot be used directly', () => {
        expect( () => {
            // @ts-ignore
            const baseFieldProcessor = new BaseFieldProcessor({});
            baseFieldProcessor.generateFieldPayloads({});
        }).to.throw('baseFieldProcessor.generateFieldPayloads is not a function');
    });

    it('Can be inherited and expanded', () => {
        expect(() => {
            // @ts-ignore
            const demoFieldProcessor = new DemoFieldProcessor({});
        }).not.to.throw();
    });

    it('Generates payload IDs as expected', () => {
        // @ts-ignore
        const demoFieldProcessor = new DemoFieldProcessor({});
        const id = demoFieldProcessor.getGeneratedID('some/path/levels', 700);
        expect(id).to.equal('some/path/levels:700');
        expect(() => demoFieldProcessor.getGeneratedID('', -1)).to.throw('Payload index must be > 0 (sent -1)');
    });

    it('Converts raw values to possible payloads as expected', () => {
        // @ts-ignore
        const demoFieldProcessor = new DemoFieldProcessor({});
        const rawValues = [1, 'some', {some: 'value'}];
        const possiblePayloads = demoFieldProcessor.getPossiblePayloads(rawValues, 'myPath');

        const possiblePayloadsSerialized = JSON.stringify(possiblePayloads);
        // tslint:disable-next-line:max-line-length
        const expected = '[{"field":{"fieldFullPath":"myPath"},"payload":1,"id":"myPath:0"},{"field":{"fieldFullPath":"myPath"},"payload":"some","id":"myPath:1"},{"field":{"fieldFullPath":"myPath"},"payload":{"some":"value"},"id":"myPath:2"}]';
        expect(possiblePayloadsSerialized).to.equal(expected);
    });

});

