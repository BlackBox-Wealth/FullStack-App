import hashlib

def generate_deterministic_hash(input_string: str) -> str:
  """
  Generates the SHA-256 hash of a given string.

  Args:
    input_string: The string to hash.

  Returns:
    The SHA-256 hash as a hexadecimal string.
  """
  normalized_input = str(input_string).strip().lower()
  encoded_string = normalized_input.encode('utf-8')
  
  # Create a SHA-256 hash object
  hash_object = hashlib.sha256(encoded_string)
  
  # Get the hexadecimal representation of the hash
  hex_digest = hash_object.hexdigest()
  
  return hex_digest # same output for same input