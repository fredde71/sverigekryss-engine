import json
import os

LEARNING_FILE = "../data/learning/corrections.json"

class LearningAgent:
    def __init__(self):
        os.makedirs(os.path.dirname(LEARNING_FILE), exist_ok=True)
        if not os.path.exists(LEARNING_FILE):
            with open(LEARNING_FILE, "w") as f:
                json.dump([], f)

    def save_correction(self, correction):
        with open(LEARNING_FILE, "r") as f:
            data = json.load(f)

        data.append(correction)

        with open(LEARNING_FILE, "w") as f:
            json.dump(data, f, indent=2)
