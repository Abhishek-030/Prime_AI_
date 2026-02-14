# from core.engine import Engine
from engine import Engine

def main():
    engine = Engine()
    while True:
        user_input = input(">> ")
        if user_input.lower().strip() in ["exit", "quit"]:
            print("Exiting Prime AI...")
            break

        response = engine.run(user_input)
        print(response)

if __name__ == "__main__":
    main()