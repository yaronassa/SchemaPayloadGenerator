import {TypeFieldProcessor} from "./typeFieldProcessor";
import {IFieldPossiblePayload, IFieldProcessingData} from "../schemaPayloadGenerator";
import {JSONSchema6} from "json-schema";

type CountHandler = (field: IFieldProcessingData) => Promise<number>;

const bluebird = require('bluebird');
const assignDeep = require('assign-deep');


class CountFieldProcessor extends TypeFieldProcessor {

    public async calculateFieldPayloadCount(field: IFieldProcessingData): Promise<number> {
        let fieldType = field.schema.type;
        if (fieldType === undefined && field.schema.enum) fieldType = 'string';
        if (fieldType === undefined && field.schema.properties) fieldType = 'object';

        const customHandler = this.generator.options.customTypeProcessors[fieldType as string];
        if (customHandler !== undefined) {
            const actualPayloads = await this.executeCustomTypeProcessor(customHandler, field);
            return actualPayloads.length;
        }

        const handler = this[`calculateSchemaFieldCount_${fieldType}`] as CountHandler;
        if (handler === undefined) throw new Error(`Could not find a count handler for ${fieldType}`);

        const result = await handler.call(this, field);

        return result;
    }

    protected async calculateSchemaFieldCount_boolean(field: IFieldProcessingData): Promise<number> {
        return 2; // [true, false].length;
    }

    protected async calculateSchemaFieldCount_integer(field: IFieldProcessingData): Promise<number> {
        return 3; // [min, max, middle].length
    }

    protected async calculateSchemaFieldCount_number(field: IFieldProcessingData): Promise<number> {
        return this.calculateSchemaFieldCount_integer(field);
    }

    protected async calculateSchemaFieldCount_string(field: IFieldProcessingData): Promise<number> {
        if (field.schema.enum) return this.calculateSchemaFieldCount_enum(field);

        return 1; // jsf.generate
    }

    protected async calculateSchemaFieldCount_enum(field: IFieldProcessingData): Promise<number> {
        return field.schema.enum.length; // enum options

    }


    protected async calculateSchemaFieldCount_array(field: IFieldProcessingData): Promise<number> {
        if (this.generator.options.combinations.arrays.combinationGenerator !== undefined) {
            const actualPayloads = await this.generateFieldPayloads(field);
            return actualPayloads.length;
        }

        const subField: IFieldProcessingData = {
            fieldTransformedKey: field.fieldTransformedKey,
            fieldKeyInParent: field.fieldKeyInParent,
            schema: field.schema.items as JSONSchema6,
            parent: field.parent,
            fieldFullPath: field.fieldFullPath
        };

        const possibleSubFieldVariationCount = await this.generator.calculateFieldPayloadCount(subField);

        if (subField.schema.type === 'object') {
            return possibleSubFieldVariationCount;
        } else {
            let pairwiseVariationCount = (possibleSubFieldVariationCount * (possibleSubFieldVariationCount - 1) / 2) + possibleSubFieldVariationCount;

            if (this.generator.options.combinations.arrays.maxCombinations) {
                pairwiseVariationCount = Math.min(pairwiseVariationCount, this.generator.options.combinations.arrays.maxCombinations);
            }

            return pairwiseVariationCount;
        }

    }

    protected async calculateSchemaFieldCount_object_oneOf(field: IFieldProcessingData): Promise<number> {
        const oneOfPossiblePayloadCount = await bluebird.reduce(field.schema.oneOf as JSONSchema6[], async (acc: number, oneOfOption: JSONSchema6) => {
            const schemaDuplicate = assignDeep({}, field.schema, oneOfOption) as JSONSchema6;
            delete schemaDuplicate.oneOf;
            const oneOfField: IFieldProcessingData = {
                schema: schemaDuplicate,
                fieldKeyInParent: field.fieldKeyInParent,
                fieldTransformedKey: field.fieldTransformedKey,
                fieldFullPath: field.fieldFullPath
            };

            const possibilitiesCount = await this.generator.calculateFieldPayloadCount(oneOfField);

            return acc + possibilitiesCount;
        }, 0) as number;

        return oneOfPossiblePayloadCount;
    }

    protected async calculateSchemaFieldCount_object_allOf(field: IFieldProcessingData): Promise<number> {
        const allOfSchemas = field.schema.allOf.reduce((acc, subSchema) => assignDeep({}, acc, subSchema));
        const combinedFieldSchema = assignDeep({}, field.schema, allOfSchemas) as JSONSchema6;
        delete combinedFieldSchema.allOf;
        combinedFieldSchema.required = field.schema.allOf.reduce((acc, subSchema: JSONSchema6) => {
            (subSchema.required || []).forEach(item => {
                if (acc.indexOf(item) < 0) acc.push(item);
            });
            return acc;
        }, []);
        const allOfField: IFieldProcessingData = {
            schema: combinedFieldSchema,
            fieldKeyInParent: field.fieldKeyInParent,
            fieldTransformedKey: field.fieldTransformedKey,
            fieldFullPath: field.fieldFullPath
        };

        return this.generator.calculateFieldPayloadCount(allOfField);
    }

    protected async calculateSchemaFieldCount_object_anyOf(field: IFieldProcessingData): Promise<number> {

        let addedEmptyPossibility = false;
        const anyOfPossiblePayloadCount = await bluebird.map(field.schema.anyOf as JSONSchema6[], async (anyOfOption: JSONSchema6) => {
            const schemaDuplicate = assignDeep({}, field.schema, anyOfOption) as JSONSchema6;
            delete schemaDuplicate.anyOf;
            const oneOfField: IFieldProcessingData = {
                schema: schemaDuplicate,
                fieldKeyInParent: field.fieldKeyInParent,
                fieldTransformedKey: field.fieldTransformedKey,
                fieldFullPath: field.fieldFullPath
            };

            let possibilities = await this.generator.calculateFieldPayloadCount(oneOfField);
            if (schemaDuplicate.required !== undefined && schemaDuplicate.required.length > 0 && addedEmptyPossibility === false) {
                addedEmptyPossibility = true;
                possibilities = possibilities + 1;
            }
            return possibilities;
        });

        const allPossibilitiesMatrixCount = anyOfPossiblePayloadCount.reduce((acc: number, currentSchemaCount: number) => {
            return acc * currentSchemaCount;
        }, 1) as number;

        return allPossibilitiesMatrixCount;
    }

    protected async calculateSchemaFieldCount_object(field: IFieldProcessingData): Promise<number> {
        if (field.schema.oneOf) return this.calculateSchemaFieldCount_object_oneOf(field);
        if (field.schema.allOf) return this.calculateSchemaFieldCount_object_allOf(field);
        if (field.schema.anyOf) return this.calculateSchemaFieldCount_object_anyOf(field);

        const combinationsLimiters = this.generator.options.combinations.objects;
        if (combinationsLimiters.optionalPayloadCombinationsGenerator || combinationsLimiters.minimalPayloadCombinationGenerator) {
            const actualPayloads = await this.generateFieldPayloads(field);
            return actualPayloads.length;
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

            let propertyVariationCount = await this.generator.calculateFieldPayloadCount(propertyField);
            if (combinationsLimiters.maxPropertiesCombinations !== undefined) {
                propertyVariationCount = Math.min(propertyVariationCount, combinationsLimiters.maxPropertiesCombinations);
            }

            acc[propertyKey] = propertyVariationCount;
            return acc;
        }, {});

        const possiblePayloadCounts = this.flattenObjectPropertiesToPayloadCount(field, fieldPropertiesPossiblePayloads);

        this.generator.report(`Generated ${possiblePayloadCounts} values for object path ${field.fieldFullPath}`);

        return possiblePayloadCounts;
    }

    /** Turn an object field's possibilities tree into actual payloads */
    protected flattenObjectPropertiesToPayloadCount(field: IFieldProcessingData, propertiesPossiblePayloadCount: {[key: string]: number}): number {

        const combinationsLimiters = this.generator.options.combinations.objects;
        const minialPayloadCount = (field.schema.required || []).reduce((existingPayloadCount: number, requiredKey: string) => {
            const possiblePropertyPayloadCount = propertiesPossiblePayloadCount[requiredKey];
            if (possiblePropertyPayloadCount === 0) return existingPayloadCount;
            return possiblePropertyPayloadCount * existingPayloadCount;
        }, 1) || 1;

        if (combinationsLimiters.maxObjectPayloadCombinations && minialPayloadCount >= combinationsLimiters.maxObjectPayloadCombinations) {
            return combinationsLimiters.maxObjectPayloadCombinations;
        }

        const nonRequiredProperties = Object.keys(propertiesPossiblePayloadCount).filter(prop => (field.schema.required || []).indexOf(prop) < 0);

        const allObjectPayloadPossibilitiesCount = nonRequiredProperties.reduce((existingPayloadCount: number, propKey: string) => {
                const possiblePropertyPayloadCount = propertiesPossiblePayloadCount[propKey];

                return existingPayloadCount * (possiblePropertyPayloadCount + 1);

            }, minialPayloadCount);

        if (combinationsLimiters.maxObjectPayloadCombinations) {
            return Math.min(combinationsLimiters.maxObjectPayloadCombinations, allObjectPayloadPossibilitiesCount);
        }

        return allObjectPayloadPossibilitiesCount;
    }

}

export {CountFieldProcessor};
