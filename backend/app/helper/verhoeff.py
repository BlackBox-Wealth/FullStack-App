"""
Verhoeff Algorithm for Aadhaar Checksum Validation.
Used to validate the 12-digit Aadhaar number.
"""

# Multiplication table
d_table = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
]

# Permutation table
p_table = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
]

# Inverse table
inv_table = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

def validate_aadhaar(number: str) -> bool:
    """
    Validates the 12-digit Aadhaar number using Verhoeff algorithm.
    The number must be exactly 12 digits.
    """
    if not number or not str(number).isdigit() or len(str(number)) != 12:
        return False
    
    number = str(number)
    c = 0
    for i, digit in enumerate(reversed(number)):
        # p_table only has 8 rows, so we use i % 8
        c = d_table[c][p_table[i % 8][int(digit)]]
    
    return c == 0

def generate_checksum(number: str) -> int:
    """
    Generates the Verhoeff checksum digit for a number.
    """
    number = str(number)
    c = 0
    for i, digit in enumerate(reversed(number)):
        c = d_table[c][p_table[(i + 1) % 8][int(digit)]]
    
    return inv_table[c]
