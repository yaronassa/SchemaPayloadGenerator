import {BaseFieldProcessor} from "./baseFieldProcessor";
import {IFieldPossiblePayload, IFieldProcessingData, SchemaPayloadGenerator} from "../schemaPayloadGenerator";
import {JSONSchema6} from "json-schema";

const jsf = require('json-schema-faker');

type TypeHandler = (field: IFieldProcessingData) => Promise<IFieldPossiblePayload>;

const bluebird = require('bluebird');
const assignDeep = require('assign-deep');

/**
 * Generate values for fields according to the field type
 */
class TypeFieldProcessor extends BaseFieldProcessor {
    constructor(generator: SchemaPayloadGenerator) {
        super(generator);
    }

    /**
     * Actually generate values for the given fields
     * @param field The field to process
     */
    public async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        let fieldType = field.schema.type;
        if (fieldType === undefined && field.schema.enum) fieldType = 'string';
        if (fieldType === undefined && field.schema.properties) fieldType = 'object';

        const customHandler = this.generator.options.customTypeProcessors[fieldType as string];
        if (customHandler !== undefined) return this.executeCustomTypeProcessor(customHandler, field);

        const handler = this[`processSchemaField_${fieldType}`] as TypeHandler;
        if (handler === undefined) throw new Error(`Could not find a type handler for ${fieldType}`);

        const result = await handler.call(this, field);

        return result;
    }

    protected async executeCustomTypeProcessor(processor: (fieldSchema: JSONSchema6) => Promise<any>, field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        let rawValues = await processor(field.schema);
        if (!Array.isArray(rawValues)) rawValues = [rawValues];

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    /** Generate values for a boolean field */
    protected async processSchemaField_boolean(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const rawValues = [true, false];

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    /** Generate values for an integer field */
    protected async processSchemaField_integer(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        let minimum = field.schema.minimum || 1;
        let maximum = field.schema.maximum || 100;

        if (field.schema.exclusiveMaximum) maximum = maximum - 1;
        if (field.schema.exclusiveMinimum) minimum = minimum + 1;

        const rawValues = [minimum, maximum, Math.floor(Math.random() * (maximum - minimum + 1) + minimum)];

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    /** Generate values for a number field */
    protected async processSchemaField_number(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        return this.processSchemaField_integer(field);
    }

    /** Generate values for an array field */
    protected async processSchemaField_array(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const subField: IFieldProcessingData = {
            fieldTransformedKey: field.fieldTransformedKey,
            fieldKeyInParent: field.fieldKeyInParent,
            schema: field.schema.items as JSONSchema6,
            parent: field.parent,
            fieldFullPath: field.fieldFullPath
        };

        const possibleSubFieldVariations = await this.generateFieldPayloads(subField);

        let arrayVariations: IFieldPossiblePayload[];

        if (subField.schema.type === 'object') {
            arrayVariations = possibleSubFieldVariations.map(value => {
                return {parentPossiblePayload: value.parentPossiblePayload, payload: value.payload, field, id: this.generatePayloadID(field, 0)};
            });
        } else {
            const pairwiseVariationRawValues = possibleSubFieldVariations.reduce((acc, value, index, arr) => {
                for (let i = index + 1; i < arr.length; i++) {
                    acc.push([value.payload, arr[i].payload]);
                }
                return acc;
            }, []);

            const allVariationsRawValues = []
                .concat(possibleSubFieldVariations.map(value => [value.payload]))
                .concat(pairwiseVariationRawValues);

            arrayVariations = this.rawValuesToPossiblePayloads(allVariationsRawValues, field);
        }

        return arrayVariations;
    }

    /** Generate values for an object field */
    protected async processSchemaField_string(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        if (field.schema.enum) return this.processSchemaField_enum(field);

        let rawValues;
        try {
            rawValues = [jsf.generate(field.schema)];
        } catch (e) {
            this.generator.report(`Warn - JSF failed for field ${field.fieldFullPath}: ${e.message}`);
            rawValues = [`Value for ${field.fieldFullPath}`];
        }


        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    /** Generate values for a field with an enum */
    protected async processSchemaField_enum(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const rawValues = [].concat(field.schema.enum);

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    /** Generate values for an object field */
    protected async processSchemaField_object(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        if (field.schema.additionalItems && (field.schema.additionalItems as JSONSchema6).oneOf) {
            // todo: change this
            const subField: IFieldProcessingData = {
                schema: (field.schema.additionalItems as JSONSchema6).oneOf[0] as JSONSchema6,
                parent: field.parent,
                fieldKeyInParent: field.fieldKeyInParent,
                fieldTransformedKey: field.fieldTransformedKey,
                fieldFullPath: field.fieldFullPath
            };

            return this.generateFieldPayloads(subField);
        }

        const fieldPropertiesPossiblePayloads = await bluebird.reduce(Object.keys(field.schema.properties), async (acc, propertyKey: string) => {
            const propertySchemaField = field.schema.properties[propertyKey] as JSONSchema6;
            const propertyField: IFieldProcessingData = {
                schema: propertySchemaField,
                fieldKeyInParent: propertyKey,
                fieldTransformedKey: this.generator.options.payloadKeyTransform(propertyKey),
                parent: field,
                fieldFullPath: field.fieldFullPath + '/' + propertyKey
            };

            const propertyVariations = await this.generateFieldPayloads(propertyField);

            acc[propertyKey] = propertyVariations;
            return acc;
        }, {});

        const possiblePayloads = this.flattenObjectPropertiesToPayloads(field, fieldPropertiesPossiblePayloads);

        this.generator.report(`Generated ${possiblePayloads.length} values for object path ${field.fieldFullPath}`);

        return possiblePayloads;
    }


    /** Turn an object field's possibilities tree into actual payloads */
    protected flattenObjectPropertiesToPayloads(field: IFieldProcessingData, propertiesPossiblePayloads: {[key: string]: IFieldPossiblePayload[]}): IFieldPossiblePayload[] {

        const minialPayloads: IFieldPossiblePayload[] = (field.schema.required || []).reduce((existingPayloads: IFieldPossiblePayload[], requiredKey: string) => {
            const possiblePropertyPayloads = propertiesPossiblePayloads[requiredKey];
            const result: IFieldPossiblePayload[] = [];

            possiblePropertyPayloads.forEach(possibleNewPayload => {
                const rawPayload = {};
                rawPayload[possibleNewPayload.field.fieldTransformedKey] = possibleNewPayload.payload;

                existingPayloads.forEach(existingPayload => {
                    const enrichedRawPayload = assignDeep({}, existingPayload.payload, rawPayload);
                    result.push({
                            payload: enrichedRawPayload,
                            field: existingPayload.field,
                            parentPossiblePayload: possibleNewPayload.parentPossiblePayload,
                            id: ''
                    });
                });
            });


            // TODO: Mark these as minimal payloads, and only create such payloads from child-properties minimal payloads as well
            return result;
        }, [{field, payload: {}, id: ''}]) || [];

        const nonRequiredProperties = Object.keys(propertiesPossiblePayloads).filter(prop => (field.schema.required || []).indexOf(prop) < 0);

        const allObjectPayloadPossibilities: IFieldPossiblePayload[] = nonRequiredProperties.reduce((existingPayloads: IFieldPossiblePayload[], propKey: string) => {
            const possiblePropertyPayloads = propertiesPossiblePayloads[propKey];
            const result: IFieldPossiblePayload[] = [].concat(existingPayloads);

            possiblePropertyPayloads.forEach(possibleNewPayload => {
                const rawPayload = {};
                rawPayload[possibleNewPayload.field.fieldTransformedKey] = possibleNewPayload.payload;

                existingPayloads.forEach(existingPayload => {
                    const enrichedRawPayload = assignDeep({}, existingPayload.payload, rawPayload);
                    result.push({payload: enrichedRawPayload, field: existingPayload.field, parentPossiblePayload: existingPayload, id: ''});
                });
            });

            return result;
        }, minialPayloads);

        allObjectPayloadPossibilities.forEach((possiblePayload, index) => possiblePayload.id = this.generatePayloadID(field, index));

        return allObjectPayloadPossibilities;
    }
}

export {TypeFieldProcessor};

