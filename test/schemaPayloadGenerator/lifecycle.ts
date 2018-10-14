import {ISchemaPayloadGeneratorOptions, SchemaPayloadGenerator} from "../../src/schemaPayloadGenerator";
import {expect} from 'chai';
import {it, describe} from 'mocha';

class SchemaPayloadGeneratorExtension extends SchemaPayloadGenerator {
    private readonly extension: string;
    constructor(options: ISchemaPayloadGeneratorOptions) {
        super(options);
        this.extension = '';
    }
}


const path = require('path');
const testDataPath = path.resolve('test', 'testData');


describe('SchemaPayloadGenerator lifecycle', () => {

    describe('Creation', () => {
        it('Creation sanity', () => {
            expect(() => new SchemaPayloadGenerator()).not.to.throw();
        });
    });

    describe('Options', () => {
       it('It can be created without an options object', () => {
           const generator = new SchemaPayloadGenerator();
       });
    });

    describe('Inheritance', () => {
       it('It can be inherited and expanded', () => {
           expect(() => {
               // @ts-ignore
               const generator = new SchemaPayloadGeneratorExtension({schema: {definitions: {some: {}}}});
           }).not.to.throw();

       });
    });

});

