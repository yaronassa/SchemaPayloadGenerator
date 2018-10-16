import {
    IFieldPossiblePayload,
    IFieldProcessingData,
    SchemaPayloadGenerator
} from "../schemaPayloadGenerator";

abstract class BaseFieldProcessor {
    protected readonly generator: SchemaPayloadGenerator;
    public constructor(generator: SchemaPayloadGenerator) {
        this.generator = generator;
    }

    public abstract async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]>;

    protected isRequiredField(field: IFieldProcessingData): boolean {
        if (field.parent === undefined) return true;
        if (field.parent.schema.required && field.parent.schema.required.indexOf(field.fieldKeyInParent) >= 0) return true;

        return false;
    }

    protected rawValuesToPossiblePayloads(rawValues: any[], field: IFieldProcessingData): IFieldPossiblePayload[] {
        return rawValues.map((payload, index) => ({field, payload, id: this.generatePayloadID(field, index)}));
    }

    protected generatePayloadID(field: IFieldProcessingData, payloadIndex: number): string {
        return `${field.fieldFullPath}:${payloadIndex}`;
    }
}

export {BaseFieldProcessor};

