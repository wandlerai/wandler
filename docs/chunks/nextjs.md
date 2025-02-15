# Next.js

When using wandler in a next.js project, you should add this to your `next.config.mjs` file:

```js
serverExternalPackages: ["@huggingface/transformers"],
```

This will make sure, that onnx-runtime is loaded correctly.
