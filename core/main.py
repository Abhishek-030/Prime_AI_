from core.engine import Engine

def main():
    engine = Engine()
    while True:
        user_input = input(">> ")
        if user_input.lower() in {"exit", "quit"}:
            break
        response = engine.run(user_input)
        print(response)

if __name__ == "__main__":
    main()
