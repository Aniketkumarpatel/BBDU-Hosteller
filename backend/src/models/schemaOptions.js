/**
 * Shared Mongoose schema options so every model serialises the same way:
 *  - virtual `id`, no `__v`
 *  - optional per-model `transform` hook (used by User to hide passwordHash)
 */
export const buildSchemaOptions = (extraTransform) => {
  const transform = (doc, ret) => {
    delete ret.__v;
    return extraTransform ? extraTransform(doc, ret) : ret;
  };

  return {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false, transform },
    toObject: { virtuals: true, versionKey: false, transform },
  };
};
