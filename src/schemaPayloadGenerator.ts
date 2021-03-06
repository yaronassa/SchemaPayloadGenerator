import {JSONSchema6} from "json-schema";
import {BaseFieldProcessor} from "./schemaFieldProcessors/baseFieldProcessor";
import {TypeFieldProcessor} from "./schemaFieldProcessors/typeFieldProcessor";
import {CountFieldProcessor} from "./schemaFieldProcessors/countFieldProcessor";
import {CustomFieldProcessor, CustomProcessorFunction} from "./schemaFieldProcessors/customFieldProcessor";
import $RefParser from "json-schema-ref-parser";

const assignDeep = require('assign-deep');
const path = require('path');
const refParser = require('json-schema-ref-parser');

interface ISchemaPayloadGeneratorOptions {
    /** Suppress logging
     * @default true
     */
    silent?: boolean,
    /** Function to transform schema property keys to payload keys (e.g. tranform to camelCase) */
    payloadKeyTransform?: (key: string) => string,
    /** Functions to process schema fields in custom ways */
    customFieldProcessors?: CustomProcessorFunction | CustomProcessorFunction[],
    /** Functions to generate values for given types in custom ways */
    customTypeProcessors?: {[type: string]: (fieldSchema: JSONSchema6) => Promise<any[]>},
    /** Control and limit the way value combinations are generated */
    combinations?: {
        arrays?: {
            /**  Simply limit the combination number */
            maxCombinations?: number,
            /**  Custom function to generate array combinations */
            combinationGenerator?: (field: IFieldProcessingData, subFieldRawValues: any[]) => any[][]
        },
        objects?: {
            /**  Simply limit the combination number for each property */
            maxPropertiesCombinations?: number,
            /**  Simply limit the total combinations object may have */
            maxObjectPayloadCombinations?: number,
            /**  Custom function to generate object minial payloads combinations */
            minimalPayloadCombinationGenerator?: (field: IFieldProcessingData, requiredPropertiesPossibilities: {[key: string]: IFieldPossiblePayload[]}) => any[],
            optionalPayloadCombinationsGenerator?: (field: IFieldProcessingData, generatedMinimalPayloads: IFieldPossiblePayload[],
                                                    optionalPropertiesPossibilities: {[key: string]: IFieldPossiblePayload[]}) => any[]
        }
    }
}

/**
 * JSON Schema field, including metadata needed for processing
 */
interface IFieldProcessingData {
    /** The field's real parent (i.e. not the .items or .oneOf nodes, but the real object parent) */
    parent?: IFieldProcessingData,
    /** The JSON schema fragment for this field */
    schema: JSONSchema6,
    /** The field name in the parent object properties */
    fieldKeyInParent: string,
    /** The field name in the parent object properties, after it was transformed */
    fieldTransformedKey: string,
    /** The field full key path from the root object, through parents, including this field */
    fieldFullPath: string
}

/**
 * A generated possible payload for a field, including generation metadata and context
 */
interface IFieldPossiblePayload {
    /** The original field */
    field: IFieldProcessingData,
    /** The actual payload fragment */
    payload: any,
    /** The parent payload possibility this one extends */
    parentPossiblePayload?: IFieldPossiblePayload,
    id: string
}

/**
 * Generates possible payloads according to a JSON schema
 */
class SchemaPayloadGenerator {
    public readonly options: ISchemaPayloadGeneratorOptions;
    /** The master schema to work from */
    public schema: JSONSchema6;
    /** Processing classes for the schema fields */
    protected fieldProcessors: {typeFieldProcessor: TypeFieldProcessor, customFieldProcessor: CustomFieldProcessor, countFieldProcessor: CountFieldProcessor};

    constructor(options?: ISchemaPayloadGeneratorOptions) {
        this.options = this.parseOptions(options);
        this.initFieldProcessors();
    }

    /**
     * Reports a message to stdout
     * @param message The message to report
     * @param endWithNewLine End the message with a new line (similar to console.log)
     */
    public report(message: string, endWithNewLine: boolean = true) {
        if (this.options.silent === false) {
            if (endWithNewLine) {
                process.stdout.write(message + '\n');
            } else {
                process.stdout.write(message);
            }
        }
    }

    /**
     * Load a master schema before generating values
     * The schema will be parsed by json-schema-ref-parser
     * @param schema Either a schema object (may contain $ref fields) or a relative path to one
     * @param parserOptions json-schema-ref-parser options (will be passed to the parser)
     */
    public async loadSchema(schema: JSONSchema6 | string, parserOptions?: $RefParser.Options) {
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

    /**
     * Generates the payload count without actually generating them (if possible)
     * @param definitionKey In case the schema contains several definitions, which on to generate values for
     */
    public async calculatePayloadCount(definitionKey?: string): Promise<number> {
        const {masterField, keyReportName} = this.extractMasterField(definitionKey);

        this.report(`Calculating payload count for ${keyReportName}`);

        const processingResult = await this.calculateFieldPayloadCount({
            schema: masterField,
            fieldKeyInParent: definitionKey || '',
            fieldTransformedKey: this.options.payloadKeyTransform(definitionKey || ''),
            fieldFullPath: definitionKey || '/'
        });

        this.report(`Would have generated ${processingResult} payloads`);

        return processingResult;
    }

    /**
     * Generate the payload for the loaded schema
     * @param definitionKey In case the schema contains several definitions, which on to generate values for
     */
    public async generatePayloads(definitionKey?: string): Promise<IFieldPossiblePayload[]> {
        if (this.schema === undefined) throw new Error(`Must load a schema before generating payloads`);

        const {masterField, keyReportName} = this.extractMasterField(definitionKey);

        this.report(`Generating payloads for ${keyReportName}`);

        const processingResult = await this.generateFieldPayloads({
            schema: masterField,
            fieldKeyInParent: definitionKey || '',
            fieldTransformedKey: this.options.payloadKeyTransform(definitionKey || ''),
            fieldFullPath: definitionKey || '/'
        });

        this.report(`Generated ${processingResult.length} payloads`);

        return processingResult;
    }

    /**
     * Generate the payload count for a single field without actually generating its values (if possible)
     * @param field
     */
    public async calculateFieldPayloadCount(field: IFieldProcessingData): Promise<number> {

        let payloadCount;
        const customProcessingResult = await this.fieldProcessors.customFieldProcessor.generateFieldPayloads(field);

        if (customProcessingResult === undefined) {
            payloadCount = await this.fieldProcessors.countFieldProcessor.calculateFieldPayloadCount(field);
        } else {
            payloadCount = customProcessingResult.length;
        }

        return payloadCount;
    }

    /**
     * Generate values for a single field
     * @param field
     */
    public async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        let processingResult = await this.fieldProcessors.customFieldProcessor.generateFieldPayloads(field);

        if (processingResult === undefined) processingResult = await this.fieldProcessors.typeFieldProcessor.generateFieldPayloads(field);

        return processingResult;
    }

    /**
     * Extracts the master schema field to process
     * @param definitionKey In case the schema contains several definitions, which on to generate values for
     */
    private extractMasterField(definitionKey?: string): {masterField: JSONSchema6, keyReportName: string} {
        if (this.schema === undefined) throw new Error(`Must load a schema before generating payloads`);

        let masterField: JSONSchema6;

        if (definitionKey === undefined) {
            if (JSON.stringify(Object.keys(this.schema)) === '["definitions"]') throw new Error('Must specify a definition for a definition-only schema');
            masterField = this.schema;
        } else {
            masterField = this.schema.definitions[definitionKey] as JSONSchema6;
            if (masterField === undefined) throw new Error(`Cannot find definition with key = ${definitionKey}`);
        }

        if (masterField.type === undefined) throw new Error(`Schema root doesn't have the mandatory "type" property`);

        const keyReportName = definitionKey || masterField.$id || masterField.title || 'main object';

        return {masterField, keyReportName};
    }

    private initFieldProcessors() {
        const typeFieldProcessor = new TypeFieldProcessor(this);
        const customFieldProcessor = new CustomFieldProcessor(this);
        const countFieldProcessor = new CountFieldProcessor(this);
        this.fieldProcessors = {typeFieldProcessor, customFieldProcessor, countFieldProcessor};
    }

    /**
     * Parses the user-passed options (in any), adds defaults, initializes them, etc.
     * @param userOptions
     */
    private parseOptions(userOptions: ISchemaPayloadGeneratorOptions = {}): ISchemaPayloadGeneratorOptions {
        const defaults: ISchemaPayloadGeneratorOptions = {
            silent: true,
            payloadKeyTransform: this.toCamelCase,
            customFieldProcessors: [],
            customTypeProcessors: {},
            combinations: {
                arrays: {

                },
                objects: {

                }
            }
        };

        const layeredOptions = assignDeep({}, defaults, userOptions) as ISchemaPayloadGeneratorOptions;

        if (!Array.isArray(layeredOptions.customFieldProcessors)) layeredOptions.customFieldProcessors = [layeredOptions.customFieldProcessors];

        return layeredOptions;
    }

    /**
     * Transforms field keys into camelCase
     * @param name
     */
    private toCamelCase(name: string): string {
        return name.replace(/_([a-z])/g, match => match[1].toUpperCase());
    }

}


export {SchemaPayloadGenerator, ISchemaPayloadGeneratorOptions, IFieldProcessingData, IFieldPossiblePayload};
