import {JSONSchema6} from "json-schema";

const assignDeep = require('assign-deep');
const path = require('path');
const refParser = require('json-schema-ref-parser');


interface ISchemaPayloadGeneratorOptions {
    silent?: boolean
}

interface ISchemaPayload {
    payload: any,
    parent?: ISchemaPayload
}

class SchemaPayloadGenerator {
    protected schema: JSONSchema6;
    protected readonly options: ISchemaPayloadGeneratorOptions;

    constructor(options?: ISchemaPayloadGeneratorOptions) {
        this.options = this.parseOptions(options);
    }

    public async loadSchema(schema: JSONSchema6 | string, parserOptions?: any) {
        if (schema === undefined) throw new Error('Must pass a schema object / path');

        if (typeof schema === 'string') {
            try {
                schema = require(path.resolve(schema));
            } catch (e) {
                throw new Error(`Failed to read schema from location = ${schema}`);
            }

        }

        try {
            this.schema = await refParser.dereference(schema, parserOptions) as JSONSchema6;
            if (this.schema === undefined) throw new Error(`Failed to parse schema: (empty result)`);
        } catch (e) {
            throw new Error(`Failed to parse schema: ${e.message}`);
        }

        const definitionCount = Object.keys(this.schema.definitions || {}).length;
        const hasDirectObject = (this.schema.type !== undefined);

        this.report(`Loaded schema with ${definitionCount} definitions${(hasDirectObject) ? ', and a direct object' : ''}`);
    }

    public async generatePayloads(definitionKey?: string): Promise<ISchemaPayload[]> {
        if (this.schema === undefined) throw new Error(`Must load a schema before generating payloads`);

        let masterDefinition: JSONSchema6;

        if (definitionKey === undefined) {
            if (JSON.stringify(Object.keys(this.schema)) === '["definitions"]') throw new Error('Must specify a definition for a definition-only schema');
            masterDefinition = this.schema;
        } else {
            masterDefinition = this.schema.definitions[definitionKey] as JSONSchema6;
            if (masterDefinition === undefined) throw new Error(`Cannot find definition with key = ${definitionKey}`);
        }

        if (masterDefinition.type === undefined) throw new Error(`Schema root doesn't have the mandatory "type" property`);

        this.report(`Generating payloads${(definitionKey) ? ' for ' + definitionKey : ''}...`);

        return [];
    }

    private parseOptions(userOptions: ISchemaPayloadGeneratorOptions = {}): ISchemaPayloadGeneratorOptions {
        const defaults: ISchemaPayloadGeneratorOptions = {
            silent: true
        };

        return assignDeep({}, defaults, userOptions);
    }

    private report(message: string) {
        // tslint:disable-next-line:no-console
        if (this.options.silent === false) console.log(message);
    }
}


export {SchemaPayloadGenerator, ISchemaPayloadGeneratorOptions, ISchemaPayload};
