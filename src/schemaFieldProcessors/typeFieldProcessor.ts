import {BaseFieldProcessor} from "./baseFieldProcessor";
import {IFieldPossiblePayload, IFieldProcessingData} from "../schemaPayloadGenerator";
import {JSONSchema6} from "json-schema";

const jsf = require('json-schema-faker');

type TypeHandler = (field: IFieldProcessingData) => Promise<IFieldPossiblePayload>;

const bluebird = require('bluebird');
const assignDeep = require('assign-deep');


class TypeFieldProcessor extends BaseFieldProcessor {
    public async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        let fieldType = field.schema.type;
        if (fieldType === undefined && field.schema.enum) fieldType = 'string';
        if (fieldType === undefined && field.schema.properties) fieldType = 'object';

        const handler = this[`processSchemaField_${fieldType}`] as TypeHandler;
        if (handler === undefined) throw new Error(`Could not find a type handler for ${fieldType}`);

        const result = await handler.call(this, field);

        return result;
    }

    protected async processSchemaField_boolean(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const rawValues = [true, false];

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    protected async processSchemaField_integer(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const minimum = field.schema.minimum || 0;
        const maximum = field.schema.maximum || 100;

        const rawValues = [minimum, maximum, Math.floor(Math.random() * maximum + minimum)];

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

    protected async processSchemaField_number(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        return this.processSchemaField_integer(field);
    }

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

            const allVariationsRawValues = [].concat(possibleSubFieldVariations.map(value => value.payload)).concat(pairwiseVariationRawValues);

            arrayVariations = this.rawValuesToPossiblePayloads(allVariationsRawValues, field);
        }

        return arrayVariations;
    }

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

    protected async processSchemaField_enum(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        const rawValues = [].concat(field.schema.enum);

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

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

            return result;
        }, [{field, payload: {}, id: ''}]) || [];

        const nonRequiredProperties = Object.keys(propertiesPossiblePayloads).filter(prop => (field.schema.required || []).indexOf(prop) < 0);

        const allObjectPayloadPossibilities: IFieldPossiblePayload[] = nonRequiredProperties.reduce((existingPayloads: IFieldPossiblePayload[], propKey: string) => {
            const possiblePropertyPayloads = propertiesPossiblePayloads[propKey];
            const result: IFieldPossiblePayload[] = [];

            possiblePropertyPayloads.forEach(possibleNewPayload => {
                const rawPayload = {};
                rawPayload[possibleNewPayload.field.fieldTransformedKey] = possibleNewPayload.payload;

                existingPayloads.forEach(existingPayload => {
                    result.push(existingPayload);
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

