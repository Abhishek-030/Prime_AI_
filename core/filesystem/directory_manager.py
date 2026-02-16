import os 

class DirectoryManager: 

    @staticmethod
    def create_directory(name:str, path:str="")->str: 
        try: 
            if not name:
                return f"Directory name not provided."
            
            base_path=path if path else os.getcwd()
            full_path=os.path.join(base_path, name)

            os.makedirs(full_path, exist_ok=True)

            return f"Directory '{name}' created at '{base_path}'."

        except Exception as e:
            return f"Error creating directory: {str(e)}" 