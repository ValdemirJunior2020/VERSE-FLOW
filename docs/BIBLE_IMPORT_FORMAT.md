# Bible Translation Import Contract

Production Bible text must be public domain or properly licensed by the church/operator.

Recommended JSON shape:

```json
{
  "translation": "CODE",
  "name": "Translation Name",
  "license": "License or permission note",
  "verses": [
    { "book": "John", "chapter": 3, "verse": 16, "text": "..." }
  ]
}
```

Import validation should reject missing translation/license metadata, duplicate verse keys, invalid chapter/verse numbers, or empty text. Never send imported scripture to an AI rewriting step.
