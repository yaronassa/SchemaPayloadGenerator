import {BaseFieldProcessor} from "./baseFieldProcessor";
import {IFieldPossiblePayload, IFieldProcessingData, SchemaPayloadGenerator} from "../schemaPayloadGenerator";
import {JSONSchema6} from "json-schema";

const bluebird = require('bluebird');

type CustomProcessorFunction = (field: IFieldProcessingData, entireSchema: JSONSchema6, processorClass: CustomFieldProcessor) => Promise<any[]>;

class CustomFieldProcessor extends BaseFieldProcessor {
    protected readonly processingFunctions: CustomProcessorFunction[];
    constructor(generator: SchemaPayloadGenerator) {
        super(generator);
        this.processingFunctions = generator.options.customFieldProcessors as CustomProcessorFunction[];
    }

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
