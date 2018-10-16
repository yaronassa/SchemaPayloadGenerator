import {JSONSchema6} from "json-schema";
import {BaseFieldProcessor} from "./schemaFieldProcessors/baseFieldProcessor";
import {TypeFieldProcessor} from "./schemaFieldProcessors/typeFieldProcessor";

const assignDeep = require('assign-deep');
const path = require('path');
const refParser = require('json-schema-ref-parser');
const bluebird = require('bluebird');

type SchemaFieldProcessor = (field: IFieldProcessingData) => Promise<any>;

interface ISchemaPayloadGeneratorOptions {
    silent?: boolean,
    payloadKeyTransform?: (key: string) => string
}

interface IFieldProcessingData {
    parent?: IFieldProcessingData,
    schema: JSONSchema6,
    fieldKeyInParent: string,
    fieldTransformedKey: string,
    fieldFullPath: string
}

interface IFieldPossiblePayload {
    field: IFieldProcessingData,
    payload: any,
    parentPossiblePayload?: IFieldPossiblePayload,
    id: string
}

class SchemaPayloadGenerator {
    public readonly options: ISchemaPayloadGeneratorOptions;
    public schema: JSONSchema6;
    protected fieldProcessors: BaseFieldProcessor[];

    constructor(options?: ISchemaPayloadGeneratorOptions) {
        this.options = this.parseOptions(options);
        this.initFieldProcessors();
    }

    public report(message: string, endWithNewLine: boolean = true) {
        if (this.options.silent === false) {
            if (endWithNewLine) {
                process.stdout.write(message + '\n');
            } else {
                process.stdout.write(message);
            }
        }
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

    public async generatePayloads(definitionKey?: string): Promise<IFieldPossiblePayload[]> {
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

        const keyReportName = definitionKey || masterDefinition.$id || masterDefinition.title || 'main object';

        this.report(`Generating payloads for ${keyReportName}`);

        const processingResult = await this.generateFieldPayloads({
            schema: masterDefinition,
            fieldKeyInParent: definitionKey || '',
            fieldTransformedKey: this.options.payloadKeyTransform(definitionKey || ''),
            fieldFullPath: definitionKey || '/'
        });

        this.report(`Generated ${processingResult.length} payloads`);

        return processingResult;
    }

    protected async generateFieldPayloads(processingData: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        let processingResult;

        for (const processor of this.fieldProcessors) {
            processingResult = await processor.generateFieldPayloads(processingData);
            if (processingResult !== undefined) break;
        }

        return processingResult;
    }

    protected initFieldProcessors() {
        const processFieldByType = new TypeFieldProcessor(this);
        this.fieldProcessors = [processFieldByType];
    }

    private parseOptions(userOptions: ISchemaPayloadGeneratorOptions = {}): ISchemaPayloadGeneratorOptions {
        const defaults: ISchemaPayloadGeneratorOptions = {
            silent: true,
            payloadKeyTransform: this.toCamelCase
        };

        return assignDeep({}, defaults, userOptions);
    }

    private toCamelCase(name: string): string {
        return name.replace(/_([a-z])/g, match => match[1].toUpperCase());
    }

}


export {SchemaPayloadGenerator, ISchemaPayloadGeneratorOptions, SchemaFieldProcessor, IFieldProcessingData, IFieldPossiblePayload};
