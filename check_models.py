from openai import OpenAI

client = OpenAI(api_key="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")

models = client.models.list()

print("Available models:")
for model in models.data:
    print(model.id)
