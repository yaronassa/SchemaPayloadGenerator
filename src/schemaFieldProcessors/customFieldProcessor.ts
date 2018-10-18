import {BaseFieldProcessor} from "./baseFieldProcessor";
import {IFieldPossiblePayload, IFieldProcessingData, SchemaPayloadGenerator} from "../schemaPayloadGenerator";
import {JSONSchema6} from "json-schema";

/**
 * A field-processor function template
 */
type CustomProcessorFunction = (field: IFieldProcessingData, entireSchema: JSONSchema6, processorClass: CustomFieldProcessor) => Promise<any[]>;

/**
 * Allows the use to load custom field-processing function and generate values by them
 */
class CustomFieldProcessor extends BaseFieldProcessor {
    /** The user loaded processing functions */
    protected readonly processingFunctions: CustomProcessorFunction[];
    constructor(generator: SchemaPayloadGenerator) {
        super(generator);
        this.processingFunctions = generator.options.customFieldProcessors as CustomProcessorFunction[];
    }

    /**
     * Actually generate values for the given fields
     * @param field The field to process
     */
    public async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]> {
        let rawValues;

        for (const processor of this.processingFunctions) {
            rawValues = await processor.call(processor, field, this.generator.schema, this);
            if (rawValues !== undefined) break;
        }

        if (rawValues === undefined) return;

        return this.rawValuesToPossiblePayloads(rawValues, field);
    }

}

export {CustomFieldProcessor, CustomProcessorFunction};
