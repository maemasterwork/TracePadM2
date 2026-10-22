# Python Statements

> The second module of the Python course: how to make programs *make decisions* and *repeat work*. You will learn `if/elif/else`, `for` and `while` loops, the most useful built-in operators and functions, and list comprehensions, and finish with a Guessing Game capstone.

**Level:** Beginner → Lower-Intermediate
**Prerequisite:** Module 1: *Python Object and Data Structure Basics*
**Requirements:** Python 3.10+
**Estimated time:** 12–16 hours (reading + practice + homework + capstone)

---

## Table of Contents

1. [Introduction to Python Statements](#1-introduction-to-python-statements)
2. [if, elif, and else Statements](#2-if-elif-and-else-statements)
3. [for Loops](#3-for-loops)
4. [while Loops](#4-while-loops)
5. [Useful Operators](#5-useful-operators)
6. [List Comprehensions](#6-list-comprehensions)
7. [Statements Assessment Test](#7-statements-assessment-test)
8. [Guessing Game Challenge](#8-guessing-game-challenge)
9. [Appendix: Cheat Sheet and Common Mistakes](#9-appendix)

> **Numbering note:** your outline skipped from 07 to 09, so the sections here are numbered 1–8 in sequence, with the appendix as 9. Nothing has been left out.
> **How to use this document:** type every example yourself, predict the output *before* running it, then do the **Try It** exercises and the **Homework**. Solutions for the assessment and the capstone are included at the end.

---

## 1. Introduction to Python Statements

### 1.1 Learning goals
- Tell **statements** from **expressions**
- Understand Python's **indentation-based blocks**
- Recognize the main kinds of statements you will use
- Write readable multi-line code and comments

### 1.2 Statements vs. expressions

- An **expression** produces a value: `3 + 4`, `len("abc")`, `x > 5`, `name.upper()`.
- A **statement** performs an action: `x = 10`, `print(x)`, `if ...:`, `for ...:`, `import math`.

```python
x = 3 + 4           # statement (assignment) containing an expression (3 + 4)
print(x * 2)        # statement (expression statement: a function call)
y = 5 if x > 5 else 0   # expression inside a statement
```

A quick test: if you can put it on the right-hand side of `=`, it is an expression.

### 1.3 Kinds of statements you already know, and what's coming

| Category | Examples | Purpose |
|---|---|---|
| Assignment | `x = 5`, `a, b = 1, 2`, `n += 1` | Bind names to values |
| Expression | `print("hi")`, `items.append(3)` | Call functions/methods |
| Import | `import math`, `from random import randint` | Bring in code |
| **Conditional** | `if / elif / else` | Choose between paths |
| **Loops** | `for`, `while` | Repeat work |
| **Loop control** | `break`, `continue`, `pass` | Change loop flow |
| Definition | `def`, `class` | Create functions/classes (next module) |
| Error handling | `try / except` | Handle failures |
| Delete | `del x[0]` | Remove names/items |

### 1.4 Blocks and indentation

Many languages use `{ }` to group code. Python uses a **colon `:`** followed by an **indented block**.

```python
age = 20

if age >= 18:
    print("You are an adult.")      # inside the if-block
    print("You can vote.")          # also inside (same indentation)
print("This always runs.")          # outside (back to the left)
```

**Rules**
1. A statement that opens a block ends with `:` (`if`, `elif`, `else`, `for`, `while`, `def`, `class`, `try`, `with`, ...).
2. Every line in the block has the **same indentation** (the standard is **4 spaces**).
3. Never mix tabs and spaces.
4. A block needs at least one statement. Use `pass` as a placeholder.

```python
if age > 100:
    pass            # TODO: handle later

# Common errors
# IndentationError: expected an indented block
# IndentationError: unindent does not match any outer indentation level
```

### 1.5 Nested blocks

```python
temperature = 28
is_raining = False

if temperature > 25:
    print("It's warm.")
    if is_raining:
        print("Take an umbrella.")
    else:
        print("Enjoy the sun!")
```

Each new level adds four more spaces.

### 1.6 Comments, line breaks, and style

```python
# A single-line comment

total = 0   # inline comment: explain WHY, not WHAT

# Long statements: use parentheses to continue across lines (preferred)
message = ("Python is readable, "
           "powerful, "
           "and fun.")

total_cost = (
    price * quantity
    + shipping
    - discount
)

# Several short statements on one line (allowed but discouraged)
a = 1; b = 2
```

**PEP 8 style reminders:** 4-space indents · lines ≤ 79–99 characters · `snake_case` names · spaces around operators (`x = a + b`) · one blank line between logical sections.

### 1.7 Practical examples

**Example 1 – A first "decision" program**
```python
balance = 250
withdrawal = 300

if withdrawal <= balance:
    balance -= withdrawal
    print(f"Done. New balance: {balance}")
else:
    print(f"Insufficient funds. You are short by {withdrawal - balance}.")
```

**Example 2 – A first "repetition" program**
```python
for day in ["Saturday", "Sunday", "Monday"]:
    print(f"Today is {day}")
```

**Example 3 – Reading the flow**
```python
count = 0
while count < 3:
    print("count is", count)
    count += 1
print("finished")
```
Trace by hand: `0`, `1`, `2` are printed, then `finished`.

### 1.8 Try It
1. Identify which of these are expressions: `5 * 2`, `x = 5`, `"a" + "b"`, `print("x")`, `if x:`.
2. Fix the indentation error:
   ```python
   if True:
   print("yes")
   ```
3. Rewrite a long `print` call over three lines with parentheses.
4. What does `pass` do? When would you use it?

### 1.9 Homework – Chapter 1
1. Write a program with three nested levels of indentation (for example: weather → temperature → rain) that prints a recommendation.
2. Take any program from Module 1 and add comments explaining each block.
3. Intentionally create an `IndentationError` and a `SyntaxError` (missing colon), then fix both and describe the messages in a comment.

---

## 2. if, elif, and else Statements

### 2.1 Learning goals
- Write one-way, two-way, and multi-way decisions
- Combine comparison and logical operators
- Use nested conditions and conditional expressions
- Avoid classic mistakes (`=` vs `==`, wrong ordering of `elif`)

### 2.2 Syntax

```python
if condition1:
    # runs when condition1 is True
elif condition2:
    # runs when condition1 is False and condition2 is True
elif condition3:
    ...
else:
    # runs when none of the above was True
```

- `elif` and `else` are **optional**.
- Python checks the conditions **top to bottom** and runs only the **first** block whose condition is true.

### 2.3 Comparison and logical operators

| Operator | Meaning |
|---|---|
| `==`  `!=` | equal / not equal |
| `<`  `<=`  `>`  `>=` | ordering |
| `in`  `not in` | membership |
| `is`  `is not` | identity (use mainly with `None`) |
| `and`  `or`  `not` | logical operators |

```python
x = 15
print(10 < x < 20)             # True  (chained comparison)
print(x % 5 == 0 and x > 10)   # True
print("a" in "banana")         # True
print(x is None)               # False
```

### 2.4 One-way, two-way, multi-way

```python
# One-way
temperature = 35
if temperature > 30:
    print("It's hot!")

# Two-way
number = 7
if number % 2 == 0:
    print("even")
else:
    print("odd")

# Multi-way
score = 82
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
elif score >= 60:
    grade = "D"
else:
    grade = "F"
print(f"Score {score} -> grade {grade}")
```

**Order matters!** With `if score >= 60` first, a score of 95 would be labelled `D`. Put the **most specific** conditions first.

### 2.5 Truthiness in conditions

```python
name = ""
if not name:
    print("Name is required.")

items = [1, 2]
if items:                 # True when the list is non-empty
    print("We have items.")

value = None
if value is None:
    print("No value yet.")
```

Prefer `if items:` over `if len(items) > 0:` and `if x is None:` over `if x == None:`.

### 2.6 Nested conditions vs. combined conditions

```python
age = 25
has_id = True

# Nested
if age >= 18:
    if has_id:
        print("Entry allowed")

# Equivalent and cleaner
if age >= 18 and has_id:
    print("Entry allowed")
```

**Guard clauses** keep code flat:
```python
def describe(age):
    if age < 0:
        return "invalid"
    if age < 13:
        return "child"
    if age < 20:
        return "teen"
    return "adult"
```

### 2.7 Conditional expression (ternary)

```python
age = 17
status = "adult" if age >= 18 else "minor"
print(status)       # minor

n = -5
print(f"{n} is {'positive' if n > 0 else 'non-positive'}")
```

Use it only for simple choices; use a regular `if` for anything complicated.

### 2.8 Bonus: `match` statement (Python 3.10+)

```python
command = "stop"

match command:
    case "go":
        print("Starting")
    case "stop" | "halt":
        print("Stopping")
    case _:
        print("Unknown command")
```

`match` shines when comparing one value against many fixed patterns; `if/elif` is still the everyday tool.

### 2.9 Practical examples

**Example 1 – Leap year**
```python
year = 2100
if (year % 4 == 0 and year % 100 != 0) or year % 400 == 0:
    print(f"{year} is a leap year")
else:
    print(f"{year} is not a leap year")   # 2100 is not
```

**Example 2 – Ticket pricing**
```python
age = 67
is_student = False

if age < 5:
    price = 0
elif age < 18 or is_student:
    price = 8
elif age >= 65:
    price = 6
else:
    price = 12
print(f"Ticket price: ${price}")
```

**Example 3 – BMI category**
```python
weight_kg, height_m = 82, 1.75
bmi = weight_kg / height_m ** 2

if bmi < 18.5:
    category = "Underweight"
elif bmi < 25:
    category = "Normal"
elif bmi < 30:
    category = "Overweight"
else:
    category = "Obese"
print(f"BMI {bmi:.1f}: {category}")
```

**Example 4 – Simple calculator**
```python
a, op, b = 12, "/", 4

if op == "+":
    result = a + b
elif op == "-":
    result = a - b
elif op == "*":
    result = a * b
elif op == "/":
    result = a / b if b != 0 else "Error: division by zero"
else:
    result = "Unknown operator"
print(result)    # 3.0
```

**Example 5 – Rock, Paper, Scissors winner**
```python
p1, p2 = "rock", "scissors"
beats = {"rock": "scissors", "paper": "rock", "scissors": "paper"}

if p1 == p2:
    print("Draw")
elif beats[p1] == p2:
    print("Player 1 wins")
else:
    print("Player 2 wins")
```

**Example 6 – Triangle classifier**
```python
a, b, c = 5, 5, 8
if a + b <= c or a + c <= b or b + c <= a:
    print("Not a triangle")
elif a == b == c:
    print("Equilateral")
elif a == b or b == c or a == c:
    print("Isosceles")
else:
    print("Scalene")
```

**Example 7 – Login with limited feedback**
```python
users = {"ali": "S3cret!", "sara": "p@ss123"}
username, password = "ali", "wrong"

if username not in users:
    print("Unknown user")
elif users[username] != password:
    print("Wrong password")
else:
    print("Welcome!")
```

### 2.10 Common mistakes

| Mistake | Problem | Fix |
|---|---|---|
| `if x = 5:` | `=` is assignment → `SyntaxError` | `if x == 5:` |
| `if x == 1 or 2:` | `2` is always truthy → always true | `if x == 1 or x == 2:` or `if x in (1, 2):` |
| Reversed `elif` order | Broad condition shadows narrow ones | Order from most specific to least |
| `if x == True:` | Redundant | `if x:` |
| Forgetting the colon | `SyntaxError` | `if cond:` |
| Comparing floats with `==` | Rounding errors | `math.isclose()` |

### 2.11 Try It
1. What is printed?
   ```python
   x = 0
   if x:
       print("A")
   elif x == 0:
       print("B")
   else:
       print("C")
   ```
2. Rewrite `if x == 1 or x == 2 or x == 3:` using `in`.
3. Rewrite the BMI example as a function that returns the category.
4. Why is `if a < b < c:` valid in Python, and what would it be in other languages?

### 2.12 Homework – Chapter 2
1. **Grade calculator:** From three exam scores compute the average and print the letter grade plus "Pass"/"Fail" (pass ≥ 10 on a 0–20 scale).
2. **Quadratic equation:** For `ax² + bx + c = 0`, use the discriminant to print "two real roots", "one root", or "no real roots", and compute the roots when they exist.
3. **Shipping fee:** Weight ≤ 1 kg → 5; ≤ 5 kg → 12; ≤ 20 kg → 30; heavier → refuse. Add 50 % surcharge for "express". Print a clear message.
4. **Day type:** Given a day number 1–7 (1 = Saturday), print "Weekend" for Friday, "Work day" for others, and "Invalid" for numbers out of range.
5. **Password policy:** A password is valid if it has ≥ 8 characters, contains a digit, an uppercase and a lowercase letter, and is not in a list of banned passwords. Print every failed rule.
6. **Challenge:** Implement a "time to greeting" program: given an hour (0–23), print Good morning / afternoon / evening / night with the proper boundaries, rejecting invalid hours.

---

## 3. for Loops

### 3.1 Learning goals
- Iterate over lists, strings, dictionaries, and ranges
- Use `range()`, `enumerate()`, and `zip()`
- Control loops with `break`, `continue`, and `else`
- Build accumulation and nested-loop patterns

### 3.2 Syntax

```python
for item in iterable:
    # do something with item
```

An **iterable** is anything you can loop over: lists, tuples, strings, dictionaries, sets, ranges, files, and more.

```python
for fruit in ["apple", "banana", "cherry"]:
    print(fruit.upper())

for ch in "Python":
    print(ch, end=" ")        # P y t h o n
print()

for a, b in [(1, "one"), (2, "two")]:      # tuple unpacking
    print(a, b)
```

### 3.3 `range()`

| Call | Produces |
|---|---|
| `range(5)` | 0, 1, 2, 3, 4 |
| `range(2, 6)` | 2, 3, 4, 5 |
| `range(0, 10, 2)` | 0, 2, 4, 6, 8 |
| `range(10, 0, -3)` | 10, 7, 4, 1 |

```python
for i in range(3):
    print("Round", i + 1)

print(list(range(1, 11)))     # [1, 2, ..., 10]
for i in range(5, 0, -1):
    print(i, end=" ")         # 5 4 3 2 1
print()
```

`range` stops **before** the end value, and it is memory-efficient (numbers are generated on demand).

### 3.4 Looping over dictionaries

```python
prices = {"apple": 1.2, "banana": 0.5, "cherry": 7.0}

for key in prices:                       # keys by default
    print(key)

for value in prices.values():
    print(value)

for fruit, price in prices.items():      # key + value
    print(f"{fruit:<8}{price:>6.2f}")
```

### 3.5 `enumerate()` and `zip()`

```python
names = ["Ali", "Sara", "Reza"]
scores = [17, 20, 15]

for index, name in enumerate(names, start=1):
    print(f"{index}. {name}")

for name, score in zip(names, scores):
    print(f"{name} scored {score}")

# Both together
for i, (name, score) in enumerate(zip(names, scores), 1):
    print(i, name, score)
```

Avoid `for i in range(len(names)):` when you only need the items. Prefer direct iteration or `enumerate`.

### 3.6 `break`, `continue`, and `else`

```python
# break: leave the loop immediately
for n in [4, 8, 15, 16, 23]:
    if n > 10:
        print("First number above 10:", n)
        break

# continue: skip to the next iteration
for n in range(1, 8):
    if n % 2 == 0:
        continue
    print(n, end=" ")        # 1 3 5 7
print()

# else: runs only if the loop was NOT ended by break
for n in [3, 5, 7]:
    if n % 2 == 0:
        print("Found an even number")
        break
else:
    print("No even numbers")
```

### 3.7 Nested loops

```python
for i in range(1, 4):
    for j in range(1, 4):
        print(f"{i * j:>3}", end="")
    print()
# Output:
#   1  2  3
#   2  4  6
#   3  6  9
```

The inner loop runs completely for each iteration of the outer loop.

### 3.8 Common loop patterns

```python
numbers = [4, 8, 15, 16, 23, 42]

# 1. Accumulator (sum)
total = 0
for n in numbers:
    total += n

# 2. Counter
evens = 0
for n in numbers:
    if n % 2 == 0:
        evens += 1

# 3. Maximum, the manual way
largest = numbers[0]
for n in numbers[1:]:
    if n > largest:
        largest = n

# 4. Build a new list
squares = []
for n in numbers:
    squares.append(n ** 2)

# 5. Search
target = 16
found_at = None
for i, n in enumerate(numbers):
    if n == target:
        found_at = i
        break

print(total, evens, largest, squares[:3], found_at)
```

### 3.9 Never modify a list while looping over it

```python
nums = [2, 4, 6, 8]

# BAD: removing shifts the remaining items, so some are skipped
for n in nums:
    if n % 2 == 0:
        nums.remove(n)
print(nums)      # [4, 8]  <-- not empty, as you might expect!

# GOOD: build a new list or iterate over a copy
nums = [1, 2, 3, 4, 5, 6]
nums = [n for n in nums if n % 2 != 0]
print(nums)      # [1, 3, 5]
```

### 3.10 Practical examples

**Example 1 – Factorial**
```python
n = 6
result = 1
for i in range(2, n + 1):
    result *= i
print(f"{n}! = {result}")    # 720
```

**Example 2 – Multiplication table**
```python
n = 7
for i in range(1, 11):
    print(f"{n} x {i:>2} = {n * i:>3}")
```

**Example 3 – Prime check**
```python
def is_prime(n):
    if n < 2:
        return False
    for d in range(2, int(n ** 0.5) + 1):
        if n % d == 0:
            return False
    return True

print([n for n in range(1, 30) if is_prime(n)])
# [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
```

**Example 4 – Triangle pattern**
```python
rows = 5
for i in range(1, rows + 1):
    print("*" * i)

for i in range(1, rows + 1):
    print(" " * (rows - i) + "*" * (2 * i - 1))   # centered pyramid
```

**Example 5 – Vowel and consonant counter**
```python
text = "Learning Python is fun"
vowels = consonants = 0
for ch in text.lower():
    if ch.isalpha():
        if ch in "aeiou":
            vowels += 1
        else:
            consonants += 1
print(vowels, consonants)   # 6 13
```

**Example 6 – Word frequency**
```python
sentence = "to be or not to be that is the question"
counts = {}
for word in sentence.split():
    counts[word] = counts.get(word, 0) + 1

for word, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
    print(f"{word:<10}{n}")
```

**Example 7 – FizzBuzz**
```python
for n in range(1, 21):
    if n % 15 == 0:
        print("FizzBuzz")
    elif n % 3 == 0:
        print("Fizz")
    elif n % 5 == 0:
        print("Buzz")
    else:
        print(n)
```

**Example 8 – Average of valid grades (skipping bad data)**
```python
raw = ["17", "abc", "15.5", "", "20", "-3"]
valid = []
for item in raw:
    try:
        grade = float(item)
    except ValueError:
        continue                 # skip non-numeric
    if 0 <= grade <= 20:
        valid.append(grade)
print(f"{len(valid)} valid grades, average {sum(valid) / len(valid):.2f}")
# 3 valid grades, average 17.50
```

**Example 9 – Fibonacci list**
```python
fib = [0, 1]
for _ in range(8):
    fib.append(fib[-1] + fib[-2])
print(fib)     # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

### 3.11 Try It
1. Print the numbers 10 down to 1, then "Liftoff!".
2. Print all numbers from 1 to 50 divisible by both 3 and 4.
3. Given `"hello world"`, build a string with every vowel replaced by `*`.
4. What does this print, and why?
   ```python
   for i in range(3):
       print(i)
   else:
       print("done")
   ```
5. Compute `1 + 1/2 + 1/3 + ... + 1/10`.

### 3.12 Homework – Chapter 3
1. **Sum of evens and odds:** For numbers 1–100 print the separate sums.
2. **Digit extraction:** Print each digit of a number given as a string and the sum of the digits.
3. **Reverse words:** `"I love Python"` → `"Python love I"` using a loop (no slicing tricks).
4. **Diamond pattern:** Print a diamond made of `*` with a height set by a variable.
5. **Perfect numbers:** Print the perfect numbers below 10,000 (a number equal to the sum of its proper divisors; 6 and 28 are examples).
6. **Shopping total:** A list of `(name, price, quantity)` tuples → print a receipt and apply a 10 % discount when the total exceeds 100.
7. **Matrix sum:** For a nested list matrix, print each row's sum, each column's sum, and the diagonal sum.
8. **Challenge – Two-sum:** Given a list and a target, print all pairs of different indices whose values add up to the target.

---

## 4. while Loops

### 4.1 Learning goals
- Repeat code until a condition changes
- Write safe loops (no accidental infinite loops)
- Validate input and build menus
- Choose between `for` and `while`

### 4.2 Syntax

```python
while condition:
    # body: repeat while condition is True
```

```python
count = 1
while count <= 5:
    print("Count:", count)
    count += 1          # without this line the loop never ends!
print("Done")
```

**Every `while` loop needs:** (1) initialization, (2) a condition, (3) an update that eventually makes the condition false.

### 4.3 `for` vs. `while`

| Use `for` when... | Use `while` when... |
|---|---|
| You know what to loop over | You don't know how many repetitions you need |
| Iterating a collection or fixed count | Waiting for an event (valid input, convergence, user quits) |

### 4.4 Infinite loops and `break`

```python
while True:                          # intentional infinite loop
    answer = input("Type 'exit' to quit: ").strip().lower()
    if answer == "exit":
        break
    print("You typed:", answer)
```

If a program hangs by accident, press **Ctrl + C** to interrupt.

### 4.5 `continue` and `else`

```python
n = 0
while n < 10:
    n += 1
    if n % 3 == 0:
        continue                # skip multiples of 3
    print(n, end=" ")           # 1 2 4 5 7 8 10
print()

attempts = 0
while attempts < 3:
    attempts += 1
else:
    print("Loop finished normally after", attempts, "attempts")
```

As with `for`, the `else` block runs only if the loop was **not** ended by `break`.

### 4.6 Input validation patterns

```python
# Keep asking until a valid positive integer arrives
while True:
    raw = input("Enter a positive integer: ")
    if raw.isdigit() and int(raw) > 0:
        number = int(raw)
        break
    print("Invalid input. Try again.")
print("You entered", number)

# Robust version with try/except (handles negatives, spaces, etc.)
while True:
    try:
        age = int(input("Your age: "))
        if 0 <= age <= 120:
            break
        print("Age must be between 0 and 120.")
    except ValueError:
        print("Please enter a whole number.")
```

### 4.7 Sentinel loops and the walrus operator

```python
total = 0
while True:
    value = input("Enter a number (or 'done'): ")
    if value == "done":
        break
    total += float(value)
print("Total:", total)

# Same idea with the walrus operator := (assigns inside an expression)
total = 0
while (value := input("Number or 'done': ")) != "done":
    total += float(value)
```

### 4.8 Practical examples

**Example 1 – Countdown timer**
```python
import time

seconds = 5
while seconds > 0:
    print(f"{seconds}...")
    time.sleep(1)
    seconds -= 1
print("Liftoff!")
```

**Example 2 – Password attempts**
```python
CORRECT = "python123"
attempts_left = 3

while attempts_left > 0:
    guess = input("Password: ")
    if guess == CORRECT:
        print("Access granted")
        break
    attempts_left -= 1
    print(f"Wrong. {attempts_left} attempt(s) left.")
else:
    print("Account locked")
```

**Example 3 – Digit sum and reverse of a number**
```python
n = 90517
digit_sum = 0
reversed_n = 0
while n > 0:
    digit = n % 10
    digit_sum += digit
    reversed_n = reversed_n * 10 + digit
    n //= 10
print(digit_sum, reversed_n)     # 22 71509
```

**Example 4 – Collatz sequence**
```python
n = 27
steps = 0
while n != 1:
    n = n // 2 if n % 2 == 0 else 3 * n + 1
    steps += 1
print("Steps:", steps)           # 111
```

**Example 5 – Savings goal**
```python
balance = 1000.0
goal = 2000.0
rate = 0.05
years = 0

while balance < goal:
    balance *= 1 + rate
    years += 1
print(f"{years} years to reach {balance:,.2f}")   # 15 years to reach 2,078.93
```

**Example 6 – Menu-driven program**
```python
cart = []

while True:
    print("\n1) Add item  2) Show cart  3) Quit")
    choice = input("Choose: ").strip()

    if choice == "1":
        cart.append(input("Item name: ").strip())
    elif choice == "2":
        if cart:
            for i, item in enumerate(cart, 1):
                print(f"{i}. {item}")
        else:
            print("Cart is empty.")
    elif choice == "3":
        print("Goodbye!")
        break
    else:
        print("Invalid choice.")
```

**Example 7 – Binary search**
```python
data = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target = 23
low, high = 0, len(data) - 1
position = -1

while low <= high:
    mid = (low + high) // 2
    if data[mid] == target:
        position = mid
        break
    elif data[mid] < target:
        low = mid + 1
    else:
        high = mid - 1
print(position)      # 5
```

**Example 8 – Square root by Newton's method**
```python
x = 2.0
guess = x / 2
while abs(guess * guess - x) > 1e-10:
    guess = (guess + x / guess) / 2
print(round(guess, 8))     # 1.41421356
```

**Example 9 – Greatest common divisor (Euclid)**
```python
a, b = 84, 36
while b != 0:
    a, b = b, a % b
print(a)     # 12
```

### 4.9 Common mistakes

| Mistake | Result | Fix |
|---|---|---|
| Forgetting the update (`count += 1`) | Infinite loop | Always change a variable in the condition |
| Wrong comparison (`<` vs `<=`) | Off-by-one errors | Trace small cases by hand |
| Checking `input()` types too late | Crash on `int("abc")` | `try/except` or `.isdigit()` |
| Condition never becomes false | Hangs | Add a guard counter or `break` |
| Using `while` where `for` is simpler | Longer, bug-prone code | Use `for` for fixed collections |

### 4.10 Try It
1. Print the powers of 2 below 1,000 using a `while` loop.
2. How many times does `while n > 1: n //= 2` run for `n = 1000`?
3. Why does `while 0.1 + 0.2 != 0.3:` need care? (Think about floats.)
4. Write a loop that stops reading numbers when the user enters a negative one and prints the average of the rest.

### 4.11 Homework – Chapter 4
1. **ATM simulator:** Start with a balance. Menu: deposit, withdraw, check balance, quit. Reject invalid amounts and overdrafts.
2. **Number reverser/palindrome:** Test whether an integer is a palindrome without converting it to a string.
3. **Doubling time:** A population grows 3 % a year. How many years until it doubles?
4. **Collatz champion:** Find the starting number below 10,000 with the longest Collatz sequence.
5. **Quiz game:** Ask 5 questions stored in a list of dictionaries; allow 2 tries per question; show the final score.
6. **Prime factorization:** Print the prime factors of a number using a `while` loop (`360` → `2 2 2 3 3 5`).
7. **Challenge – Digital root:** Repeatedly sum digits until a single digit remains (`9875` → `29` → `11` → `2`).

---

## 5. Useful Operators

This chapter collects the operators and built-in functions you will use in almost every loop or condition.

### 5.1 `range()`: recap and tricks

```python
print(list(range(5)))              # [0, 1, 2, 3, 4]
print(list(range(10, 0, -2)))      # [10, 8, 6, 4, 2]
print(sum(range(1, 101)))          # 5050
print(len(range(0, 100, 7)))       # 15
print(7 in range(0, 100, 7))       # True (fast, no list is built)
```

### 5.2 `enumerate()`

```python
tasks = ["email", "report", "gym"]
for number, task in enumerate(tasks, start=1):
    print(f"{number}. {task}")
```

### 5.3 `zip()`

```python
names = ["Ali", "Sara", "Reza"]
ages = [30, 25, 41]
cities = ["Tehran", "Shiraz", "Tabriz"]

for n, a, c in zip(names, ages, cities):
    print(f"{n} ({a}) from {c}")

print(dict(zip(names, ages)))        # {'Ali': 30, 'Sara': 25, 'Reza': 41}
print(list(zip("ab", [1, 2, 3])))    # [('a', 1), ('b', 2)]  (stops at the shortest)

# "Unzip" with *
pairs = [("a", 1), ("b", 2), ("c", 3)]
letters, numbers = zip(*pairs)
print(letters, numbers)               # ('a','b','c') (1,2,3)
```

### 5.4 Membership operators: `in` / `not in`

```python
print("py" in "python")               # True (substring)
print(3 in [1, 2, 3])                 # True
print("name" in {"name": "Ali"})      # True (keys)
print(5 not in {1, 2, 3})             # True

vowels = "aeiou"
word = "rhythm"
if not any(ch in vowels for ch in word):
    print("No vowels!")
```

### 5.5 `min()`, `max()`, `sum()`, `len()`, `abs()`

```python
nums = [4, 8, 15, 16, 23, 42]
print(min(nums), max(nums), sum(nums), len(nums))
print(max("apple", "banana"))                       # 'banana' (alphabetical)
print(max(["pear", "fig", "banana"], key=len))      # 'banana'
print(min(nums, key=lambda n: abs(n - 20)))         # 23 (closest to 20: distance 3 vs 4 for 16)
```

### 5.6 `sorted()` and `reversed()`

```python
data = [5, 2, 9, 1]
print(sorted(data))                    # [1, 2, 5, 9]
print(sorted(data, reverse=True))      # [9, 5, 2, 1]
print(list(reversed(data)))            # [1, 9, 2, 5]

students = [("Ali", 17), ("Sara", 20), ("Reza", 17)]
print(sorted(students, key=lambda s: (-s[1], s[0])))
# [('Sara', 20), ('Ali', 17), ('Reza', 17)]
```

### 5.7 `any()` and `all()`

```python
scores = [12, 15, 9, 18]
print(all(s >= 10 for s in scores))    # False
print(any(s >= 18 for s in scores))    # True

password = "Abc12345"
rules = [
    len(password) >= 8,
    any(c.isdigit() for c in password),
    any(c.isupper() for c in password),
]
print("Strong" if all(rules) else "Weak")
```

### 5.8 `input()` and type conversion

`input()` **always returns a string**. Convert it:

```python
name = input("Name: ")
age = int(input("Age: "))
height = float(input("Height (m): "))
numbers = [int(x) for x in input("Numbers separated by space: ").split()]
```

### 5.9 The `random` module

```python
import random

print(random.randint(1, 6))               # integer from 1 to 6 inclusive
print(random.random())                    # float in [0.0, 1.0)
print(random.choice(["rock", "paper", "scissors"]))
print(random.sample(range(1, 50), 6))     # 6 unique numbers (lottery)

deck = list(range(1, 11))
random.shuffle(deck)                      # shuffles in place
print(deck)

random.seed(42)                           # reproducible results (great for tests)
```

### 5.10 `map()`, `filter()`, and `lambda` (preview)

```python
nums = [1, 2, 3, 4, 5, 6]

doubled = list(map(lambda n: n * 2, nums))          # [2, 4, 6, 8, 10, 12]
evens = list(filter(lambda n: n % 2 == 0, nums))    # [2, 4, 6]
as_text = list(map(str, nums))                      # ['1', '2', ...]
```

Comprehensions (next chapter) are usually clearer than `map`/`filter`.

### 5.11 Other handy operators

```python
# Unpacking
first, *middle, last = [1, 2, 3, 4, 5]
combined = [*[1, 2], *[3, 4]]                # [1, 2, 3, 4]

# Chained comparison
x = 15
print(10 < x <= 20)

# Augmented assignment
total = 0
total += 5

# Ternary expression
label = "even" if x % 2 == 0 else "odd"

# Identity
print(None is None)

# String repetition & joining
print("=" * 20)
print(", ".join(["a", "b", "c"]))

# divmod
minutes, seconds = divmod(135, 60)     # (2, 15)
```

### 5.12 Practical examples

**Example 1 – Lottery ticket checker**
```python
import random

my_numbers = set(random.sample(range(1, 50), 6))
draw = set(random.sample(range(1, 50), 6))
matches = my_numbers & draw
print("Mine:", sorted(my_numbers))
print("Draw:", sorted(draw))
print(f"{len(matches)} match(es): {sorted(matches)}")
```

**Example 2 – Student ranking with `zip` and `sorted`**
```python
names = ["Ali", "Sara", "Reza", "Neda"]
scores = [17.5, 19.0, 15.25, 19.0]

ranking = sorted(zip(names, scores), key=lambda p: (-p[1], p[0]))
for place, (name, score) in enumerate(ranking, 1):
    print(f"{place}. {name:<6}{score:>6.2f}")
```

**Example 3 – Dice simulation and frequency**
```python
import random
from collections import Counter

rolls = [random.randint(1, 6) for _ in range(600)]
freq = Counter(rolls)
for face in range(1, 7):
    print(f"{face}: {'#' * (freq[face] // 5)} {freq[face]}")
```

**Example 4 – Validate a list of emails with `all()`**
```python
emails = ["a@x.com", "b@y.org", "bad.email"]
valid = [e for e in emails if "@" in e and "." in e.split("@")[-1]]
print(valid, all("@" in e for e in emails))
```

**Example 5 – Transposing data with `zip(*)`**
```python
matrix = [[1, 2, 3], [4, 5, 6]]
transposed = [list(row) for row in zip(*matrix)]
print(transposed)    # [[1, 4], [2, 5], [3, 6]]
```

**Example 6 – Simple "Magic 8-ball"**
```python
import random

answers = ["Yes", "No", "Maybe", "Ask again later", "Definitely", "Very doubtful"]
input("Ask a yes/no question: ")
print(random.choice(answers))
```

### 5.13 Try It
1. Use `zip` to combine `["a","b","c"]` and `[1,2,3]` into a dictionary, then invert it.
2. Use `max(..., key=...)` to find the longest word in a sentence.
3. What does `list(zip(range(5), "ab"))` return?
4. Use `random.sample` to deal 5 distinct cards from `range(1, 53)`.

### 5.14 Homework – Chapter 5
1. **Rock, Paper, Scissors:** Play against the computer (`random.choice`) for best of 3, with input validation.
2. **Dice statistics:** Roll two dice 1,000 times; print the frequency of each sum (2–12) as a bar chart of `#`.
3. **Dot product:** Compute the dot product of two equal-length lists using `zip` and `sum`.
4. **Report card:** Given parallel lists of names, math scores, and science scores, print a sorted table (best average first) with `zip`.
5. **Random password generator:** Length chosen by the user; guarantee at least one digit, one uppercase, and one lowercase letter.

---

## 6. List Comprehensions

### 6.1 Learning goals
- Build lists in a single, readable expression
- Filter and transform items
- Use nested and conditional comprehensions
- Know the dictionary, set, and generator variants and when **not** to use them

### 6.2 From loop to comprehension

```python
# Loop version
squares = []
for n in range(1, 6):
    squares.append(n ** 2)

# Comprehension version
squares = [n ** 2 for n in range(1, 6)]
print(squares)       # [1, 4, 9, 16, 25]
```

**Pattern:** `[expression for item in iterable]`

Read it aloud as: *"give me `expression` for each `item` in `iterable`."*

### 6.3 Filtering with `if`

`[expression for item in iterable if condition]`

```python
nums = range(1, 21)
evens = [n for n in nums if n % 2 == 0]
div_by_3_and_5 = [n for n in nums if n % 3 == 0 or n % 5 == 0]
long_words = [w for w in ["a", "tree", "python", "go"] if len(w) > 2]
```

### 6.4 Transforming with `if ... else`

When `if/else` is part of the **expression**, it goes at the **front**:

`[value_if_true if condition else value_if_false for item in iterable]`

```python
scores = [8, 12, 17, 9]
results = ["pass" if s >= 10 else "fail" for s in scores]
print(results)      # ['fail', 'pass', 'pass', 'fail']

cleaned = [n if n >= 0 else 0 for n in [3, -1, 7, -9]]
print(cleaned)      # [3, 0, 7, 0]
```

> **Memory trick:** filter-only `if` goes at the **end**; choose-a-value `if/else` goes at the **front**.

### 6.5 Working with strings and methods

```python
words = ["  apple ", "BANANA", " Cherry"]
tidy = [w.strip().title() for w in words]
print(tidy)         # ['Apple', 'Banana', 'Cherry']

sentence = "Python is awesome"
print([w[0] for w in sentence.split()])         # ['P', 'i', 'a']
print([ch for ch in sentence if ch.isupper()])  # ['P']
print([len(w) for w in sentence.split()])       # [6, 2, 7]
```

### 6.6 Multiple loops (nested comprehension)

```python
# All pairs
pairs = [(x, y) for x in [1, 2] for y in ["a", "b"]]
print(pairs)     # [(1,'a'), (1,'b'), (2,'a'), (2,'b')]

# Multiplication table as nested lists
table = [[i * j for j in range(1, 4)] for i in range(1, 4)]
print(table)     # [[1, 2, 3], [2, 4, 6], [3, 6, 9]]

# Flatten
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [x for row in matrix for x in row]
print(flat)      # [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

The reading order of multiple `for` clauses equals the order you would write nested loops.

### 6.7 Dictionary, set, and generator comprehensions

```python
# Dictionary comprehension
squares = {n: n ** 2 for n in range(1, 6)}
lengths = {w: len(w) for w in ["pear", "fig", "banana"]}
inverted = {v: k for k, v in {"a": 1, "b": 2}.items()}

# Set comprehension (unique results)
remainders = {n % 4 for n in range(20)}      # {0, 1, 2, 3}

# Generator expression: lazy, no list is built (great inside sum/max/any)
total = sum(n ** 2 for n in range(1_000_000))
has_negative = any(n < 0 for n in [3, 5, -1])
```

### 6.8 When *not* to use a comprehension

| Situation | Better choice |
|---|---|
| Needs multiple statements or `try/except` | Regular `for` loop |
| Very long or deeply nested (3+ levels) | Loop or helper function |
| Used only for side effects (`[print(x) for x in xs]`) | Plain `for` loop |
| Giant data you only iterate once | Generator expression |

**Readability first.** If you can't read it in one breath, split it up.

### 6.9 Practical examples

**Example 1 – Celsius to Fahrenheit table**
```python
celsius = [0, 20, 37, 100]
fahrenheit = [round(c * 9 / 5 + 32, 1) for c in celsius]
print(list(zip(celsius, fahrenheit)))
# [(0, 32.0), (20, 68.0), (37, 98.6), (100, 212.0)]
```

**Example 2 – Clean and filter user input**
```python
raw = ["  Ali ", "", "SARA", "  ", "reza"]
names = [n.strip().title() for n in raw if n.strip()]
print(names)    # ['Ali', 'Sara', 'Reza']
```

**Example 3 – Primes up to 50**
```python
primes = [n for n in range(2, 51) if all(n % d != 0 for d in range(2, int(n ** 0.5) + 1))]
print(primes)
```

**Example 4 – Pythagorean triples**
```python
triples = [(a, b, c)
           for a in range(1, 21)
           for b in range(a, 21)
           for c in range(b, 30)
           if a * a + b * b == c * c]
print(triples)
# [(3, 4, 5), (5, 12, 13), (6, 8, 10), (8, 15, 17), (9, 12, 15), (12, 16, 20), (15, 20, 25)]
```

**Example 5 – Grade book transformation**
```python
students = {"Ali": [17, 15, 18], "Sara": [20, 19, 18], "Reza": [12, 14, 10]}
averages = {name: round(sum(g) / len(g), 2) for name, g in students.items()}
honor_roll = [name for name, avg in averages.items() if avg >= 16]
print(averages)      # {'Ali': 16.67, 'Sara': 19.0, 'Reza': 12.0}
print(honor_roll)    # ['Ali', 'Sara']
```

**Example 8 – Transpose and diagonal**
```python
m = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
transpose = [[row[i] for row in m] for i in range(3)]
diagonal = [m[i][i] for i in range(3)]
print(transpose, diagonal)
```

**Example 6 – Word-length analysis**
```python
text = "the quick brown fox jumps over the lazy dog"
by_length = {}
for w in text.split():
    by_length.setdefault(len(w), []).append(w)
print({k: sorted(set(v)) for k, v in sorted(by_length.items())})
```

**Example 7 – Remove vowels**
```python
sentence = "Comprehensions are powerful"
print("".join(ch for ch in sentence if ch.lower() not in "aeiou"))
# Cmprhnsns r pwrfl
```

### 6.10 Try It
1. Write comprehensions for: the cubes of 1–10; the odd numbers 1–99; the first letter of each word in a sentence.
2. Convert this loop into a comprehension:
   ```python
   result = []
   for w in words:
       if len(w) > 3:
           result.append(w.upper())
   ```
3. What does `[x * y for x in range(1, 4) for y in range(1, 4) if x != y]` produce?
4. Why is `[n if n > 0 for n in nums]` a `SyntaxError`?

### 6.11 Homework – Chapter 6
1. **Pairs sum:** Using a comprehension, list all pairs `(a, b)` from `1..10` with `a < b` and `a + b == 12`.
2. **Capitalizer:** Turn `["ali reza", "sara karimi"]` into `["Ali Reza", "Sara Karimi"]`.
3. **Count positives:** From a list with positive, negative, and zero values, return three lists (positive, negative, zero) with three comprehensions.
4. **Matrix tasks:** For a 3×3 matrix compute: all elements doubled, row sums, column sums, and the flattened list.
5. **Dictionary challenge:** From a list of words create `{first_letter: [words]}` (hint: set of first letters + comprehension).
6. **Challenge:** Generate Pascal's triangle (first 6 rows) with comprehensions and print it centered.

---

## 7. Statements Assessment Test

**Time:** 60–75 minutes · **Total:** 100 points · **Rules:** No internet. Use the Python shell for Part C only.

### Part A – Multiple Choice (2 points each = 20 points)

**A1.** What is printed by `for i in range(2, 10, 3): print(i, end=" ")`?
- a) `2 5 8`  b) `2 5 8 10`  c) `2 5`  d) `3 6 9`

**A2.** Which keyword skips the rest of the current iteration and moves to the next one?
- a) `break`  b) `pass`  c) `continue`  d) `next`

**A3.** The `else` block of a `while` loop runs when...
- a) the condition is false at the start only  b) the loop ends without hitting `break`  c) an error occurs  d) `continue` is executed

**A4.** What is `y`? `x = 5; y = "big" if x > 3 else "small"`
- a) `"small"`  b) `True`  c) `"big"`  d) `5`

**A5.** `list(range(5))` is...
- a) `[1, 2, 3, 4, 5]`  b) `[0, 1, 2, 3, 4]`  c) `[0, 1, 2, 3, 4, 5]`  d) `[5]`

**A6.** Which line is a syntax error?
- a) `if x == 5:`  b) `if x = 5:`  c) `if x != 5:`  d) `if not x:`

**A7.** `[x for x in range(5) if x % 2]` gives...
- a) `[0, 2, 4]`  b) `[1, 3]`  c) `[1, 3, 5]`  d) `[True, False, ...]`

**A8.** What does `pass` do?
- a) exits the program  b) skips the loop  c) does nothing (placeholder)  d) raises an error

**A9.** Which is a correct way to loop with both index and value?
- a) `for i, v in enumerate(items):`  b) `for i, v in items:`  c) `for i in enumerate(items, v):`  d) `for v in items.index():`

**A10.** What is printed? `for i in []: print("a")` followed by `else: print("b")` attached to the `for`
- a) `a`  b) `b`  c) nothing  d) error

### Part B – Predict the Output (3 points each = 30 points)

**B1.**
```python
total = 0
for i in range(1, 6):
    if i % 2 == 0:
        continue
    total += i
print(total)
```

**B2.**
```python
n = 10
while n > 0:
    n -= 3
    if n == 4:
        break
print(n)
```

**B3.**
```python
for i in range(3):
    for j in range(i):
        print(i, j)
```

**B4.**
```python
words = ["apple", "kiwi", "banana"]
print([w.upper() for w in words if len(w) > 4])
```

**B5.**
```python
for i, ch in enumerate("abc", start=1):
    print(i * ch, end="|")
```

**B6.**
```python
x = 7
if x > 5:
    print("A")
elif x > 3:
    print("B")
else:
    print("C")
if x > 6:
    print("D")
```

**B7.**
```python
for n in range(2, 6):
    for d in range(2, n):
        if n % d == 0:
            break
    else:
        print(n, end=" ")
```

**B8.**
```python
print(list(zip("ab", [1, 2, 3])))
```

**B9.**
```python
print([[i * j for j in range(1, 4)] for i in range(1, 3)])
```

**B10.**
```python
count = 0
while count < 3:
    count += 1
else:
    print("done", count)
```

### Part C – Coding Challenges (10 points each = 50 points)

**C1. Grade classifier.** Write `classify(score)` for a score from 0 to 100: 90+ → `"A"`, 80–89 → `"B"`, 70–79 → `"C"`, 60–69 → `"D"`, below 60 → `"F"`; any score outside 0–100 → `"Invalid"`. Then print the grade for `[95, 82, 71, 65, 40, 101]`.

**C2. Digits with `while`.** Write `digit_info(n)` for a positive integer that returns `(digit_sum, reversed_number, is_palindrome)` using a `while` loop and arithmetic only. Test with `12321` and `4057`.

**C3. Patterns.** Print the following two patterns for `n = 5` using loops:
```
1
12
123
1234
12345
```
and the same numbers right-aligned:
```
    1
   12
  123
 1234
12345
```

**C4. Comprehensions.** Given `words = ["python", "is", "a", "powerful", "language", "for", "everyone"]`, write one comprehension each for: (a) words longer than 3 letters, in upper case; (b) a dictionary `{word: length}`; (c) the set of first letters; (d) a list of `"short"`/`"long"` labels (long means 5+ letters).

**C5. Prime finder.** Write a program that asks for an integer `N` (repeat until it is a valid integer ≥ 2), then prints all primes up to `N` and how many there are. Use a `for ... else` or a helper function.

---

### Answer Key

**Part A:** A1 → **a** · A2 → **c** · A3 → **b** · A4 → **c** · A5 → **b** · A6 → **b** · A7 → **b** (odd numbers: `x % 2` is truthy for 1 and 3) · A8 → **c** · A9 → **a** · A10 → **b** (the loop never runs and never hits `break`, so the `else` block executes)

**Part B:**
- B1: `9` (1 + 3 + 5)
- B2: `4` (n goes 10 → 7 → 4, then `break`)
- B3: three lines: `1 0`, `2 0`, `2 1`
- B4: `['APPLE', 'BANANA']`
- B5: `a|bb|ccc|`
- B6: `A` then `D` (two separate `if` statements)
- B7: `2 3 5 ` (primes between 2 and 5)
- B8: `[('a', 1), ('b', 2)]`
- B9: `[[1, 2, 3], [2, 4, 6]]`
- B10: `done 3`

**Part C: Sample solutions**

```python
# C1
def classify(score):
    if not 0 <= score <= 100:
        return "Invalid"
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"

print([classify(s) for s in [95, 82, 71, 65, 40, 101]])
# ['A', 'B', 'C', 'D', 'F', 'Invalid']
```

```python
# C2
def digit_info(n):
    original = n
    digit_sum = 0
    reversed_number = 0
    while n > 0:
        digit = n % 10
        digit_sum += digit
        reversed_number = reversed_number * 10 + digit
        n //= 10
    return digit_sum, reversed_number, reversed_number == original

print(digit_info(12321))   # (9, 12321, True)
print(digit_info(4057))    # (16, 7504, False)
```

```python
# C3
n = 5
for i in range(1, n + 1):
    print("".join(str(d) for d in range(1, i + 1)))

for i in range(1, n + 1):
    print("".join(str(d) for d in range(1, i + 1)).rjust(n))
```

```python
# C4
words = ["python", "is", "a", "powerful", "language", "for", "everyone"]

a = [w.upper() for w in words if len(w) > 3]
b = {w: len(w) for w in words}
c = {w[0] for w in words}
d = ["long" if len(w) >= 5 else "short" for w in words]

print(a)   # ['PYTHON', 'POWERFUL', 'LANGUAGE', 'EVERYONE']
print(b)
print(sorted(c))   # ['a', 'e', 'f', 'i', 'l', 'p']
print(d)
```

```python
# C5
while True:
    raw = input("Enter an integer N >= 2: ").strip()
    if raw.isdigit() and int(raw) >= 2:
        N = int(raw)
        break
    print("Invalid input.")

primes = []
for n in range(2, N + 1):
    for d in range(2, int(n ** 0.5) + 1):
        if n % d == 0:
            break
    else:
        primes.append(n)

print(primes)
print(f"{len(primes)} primes up to {N}")
```

**Scoring guide:** 90–100 Excellent · 75–89 Good · 60–74 Review the weak chapters · below 60 Redo the chapters and homework.

---

## 8. Guessing Game Challenge

### 8.1 The challenge

Build a console game where the computer picks a **secret number between 1 and 100** and the player tries to find it. This capstone uses `random`, `while`, `if/elif/else`, `input` validation, lists, and (in the extensions) functions and files.

### 8.2 Game rules

1. The computer picks a random integer from 1 to 100.
2. The player types a guess.
3. If the guess is **outside 1–100** (or not a number), print a message. This guess **does not count**.
4. On the **first** guess:
   - if it's within **10** of the secret number → print `WARM!`
   - otherwise → print `COLD!`
5. On **every following guess**:
   - if it's **closer** than the previous guess → print `WARMER!`
   - if it's **farther** → print `COLDER!`
   - if the distance is the same → print `SAME DISTANCE!`
6. When the player guesses correctly, print the secret number and **how many guesses** it took, then stop.

**Sample session** (secret = 42):
```
I'm thinking of a number between 1 and 100.
Your guess: 90
COLD!
Your guess: 150
OUT OF RANGE! Pick a number between 1 and 100.
Your guess: 60
WARMER!
Your guess: 20
COLDER!
Your guess: 40
WARMER!
Your guess: 42
You got it! The number was 42. It took you 5 guesses.
```

### 8.3 Build it in levels

Do **not** write everything at once. Complete one level, test it, then continue.

| Level | Goal | Concepts |
|---|---|---|
| 1 | Pick a secret number and loop until the player guesses it | `random.randint`, `while True`, `break` |
| 2 | Validate input (non-numbers, out of range, doesn't count) | `isdigit`/`try-except`, `continue` |
| 3 | Add `WARM!`/`COLD!` for the first guess | `abs()`, `if/else` |
| 4 | Add `WARMER!`/`COLDER!` for later guesses | storing the previous guess |
| 5 | Count guesses and print the result | counters, lists, f-strings |
| 6 | Wrap into functions; add "play again?" | `def`, return values |

### 8.4 Hints

- Distance from the secret is `abs(guess - secret)`.
- Keep a list `guesses` (valid ones only). The first guess is when `guesses` is empty; the previous guess is `guesses[-1]`.
- Use `continue` for invalid input so the rest of the loop body is skipped and nothing is counted.
- `int(raw)` crashes on non-numbers. Check first (`raw.lstrip("-").isdigit()`) or use `try/except ValueError`.
- Remember: `input()` returns a string.
- To test your logic, temporarily print the secret number.

### 8.5 Complete solution (all levels)

```python
import random


def get_guess(low, high):
    """Ask until the player enters a number. Return an int, or None to quit."""
    while True:
        raw = input("Your guess (or 'q' to quit): ").strip()
        if raw.lower() == "q":
            return None
        try:
            guess = int(raw)
        except ValueError:
            print("Please enter a whole number.")
            continue
        if not low <= guess <= high:
            print(f"OUT OF RANGE! Pick a number between {low} and {high}.")
            continue
        return guess


def feedback(guess, secret, previous_guess=None):
    """Return the hint text for a wrong guess."""
    if previous_guess is None:
        return "WARM!" if abs(guess - secret) <= 10 else "COLD!"
    current = abs(guess - secret)
    previous = abs(previous_guess - secret)
    if current < previous:
        return "WARMER!"
    if current > previous:
        return "COLDER!"
    return "SAME DISTANCE!"


def play(low=1, high=100):
    secret = random.randint(low, high)
    guesses = []
    print(f"\nI'm thinking of a number between {low} and {high}.")

    while True:
        guess = get_guess(low, high)
        if guess is None:
            print(f"The number was {secret}. Bye!")
            return None

        if guess == secret:
            guesses.append(guess)
            print(f"You got it! The number was {secret}. "
                  f"It took you {len(guesses)} guesses.")
            return len(guesses)

        previous = guesses[-1] if guesses else None
        print(feedback(guess, secret, previous))
        guesses.append(guess)


def main():
    while True:
        play()
        again = input("\nPlay again? (y/n): ").strip().lower()
        if again != "y":
            print("Thanks for playing!")
            break


if __name__ == "__main__":
    main()
```

Why this design works:
- `get_guess` handles **all input problems** in one place, so invalid guesses never reach the game logic and never count.
- `feedback` is a pure function (no `input`/`print`), so you can **test it without playing**:

```python
assert feedback(50, 55) == "WARM!"                        # first guess, distance 5
assert feedback(10, 55) == "COLD!"                        # first guess, distance 45
assert feedback(50, 55, previous_guess=10) == "WARMER!"
assert feedback(10, 55, previous_guess=50) == "COLDER!"
assert feedback(45, 55, previous_guess=65) == "SAME DISTANCE!"
print("All feedback tests passed")
```

### 8.6 Extensions (pick at least two)

1. **Limited attempts:** The player has 8 guesses; show how many remain. Reveal the number when they lose.
2. **Difficulty levels:** Easy (1–50, 10 tries), Medium (1–100, 8 tries), Hard (1–500, 9 tries). Use a dictionary of settings.
3. **Binary-search coach:** After the game, print the maximum number of guesses an optimal player needs (`math.ceil(math.log2(high - low + 1))`).
4. **Higher/Lower hints:** Add an optional `hint` mode that also says whether to go higher or lower.
5. **High-score table (JSON):** Store the best (lowest) guess count per difficulty in `scores.json`:

```python
import json
from pathlib import Path

SCORES = Path("scores.json")

def load_scores():
    try:
        return json.loads(SCORES.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def record(difficulty, guesses):
    scores = load_scores()
    best = scores.get(difficulty)
    if best is None or guesses < best:
        scores[difficulty] = guesses
        SCORES.write_text(json.dumps(scores, indent=2), encoding="utf-8")
        return True      # new record
    return False
```

6. **Computer guesses:** Reverse roles. The user thinks of a number and answers `higher`/`lower`/`correct`; the computer uses binary search.
7. **Game history:** Append each game (date, secret, guesses list) to a CSV file, and add a menu option to show statistics (games played, average guesses, best game).

### 8.7 Testing checklist

| Test | Expected behavior |
|---|---|
| Type `abc` | "Please enter a whole number." Not counted |
| Type `0` and `101` | Out-of-range message. Not counted |
| Type `-5` | Out-of-range message. Not counted |
| Guess within 10 of the secret on the first try | `WARM!` |
| Guess far away first, then a closer number | `COLD!` then `WARMER!` |
| Guess the same number twice | `SAME DISTANCE!` |
| Guess correctly on the first try | "It took you 1 guesses." (bonus: handle singular "guess") |
| Type `q` | Game ends, reveals the number |
| Answer `n` to "Play again?" | Program exits cleanly |

### 8.8 Grading rubric (20 points)

| Criterion | Points |
|---|---|
| Correct random number and game loop | 3 |
| Input validation (non-numeric and out of range, not counted) | 4 |
| Correct WARM/COLD (first guess) and WARMER/COLDER (later) logic | 4 |
| Guess counter and final message | 2 |
| Code structure (functions, naming, comments) | 3 |
| Play again feature | 1 |
| At least one extension | 3 |

---

## 9. Appendix

### 9.1 Control-flow cheat sheet

```python
# Conditionals
if cond1:
    ...
elif cond2:
    ...
else:
    ...

value = a if cond else b            # conditional expression

# Loops
for item in iterable:               # fixed collection / range
    ...
while cond:                         # repeat until condition is False
    ...

# Loop control
break        # leave the loop
continue     # next iteration
pass         # do nothing (placeholder)
# for/while ... else:  runs only if the loop did NOT break

# Handy
range(start, stop, step)
enumerate(seq, start=1)
zip(a, b, c)
[expr for x in iterable if cond]
```

### 9.2 Which loop? A quick decision guide

1. Do you have a collection, string, or a known count? → **`for`**
2. Are you waiting for something to happen (valid input, goal reached)? → **`while`**
3. Are you building a new list from an existing one in one simple step? → **comprehension**
4. Do you need both index and value? → **`enumerate`**
5. Do you need to walk two lists together? → **`zip`**

### 9.3 Common mistakes checklist

| Mistake | Fix |
|---|---|
| `if x = 5:` | `if x == 5:` |
| `if x == 1 or 2:` | `if x in (1, 2):` |
| Missing colon after `if`, `for`, `while`, `else` | Add `:` |
| Inconsistent indentation / mixing tabs and spaces | Use 4 spaces everywhere |
| Infinite `while` loop (no update) | Update the loop variable; test with small inputs; Ctrl + C |
| Off-by-one with `range(1, n)` | Use `range(1, n + 1)` to include `n` |
| Modifying a list while iterating over it | Iterate over a copy or build a new list |
| Forgetting that `input()` returns a string | Convert with `int()` / `float()` |
| Putting a filter-`if` at the front of a comprehension | Filter goes at the end, `if/else` goes at the front |
| `[print(x) for x in xs]` | Use a normal `for` loop for side effects |
| Using `for i in range(len(xs))` unnecessarily | `for x in xs` or `enumerate(xs)` |
| `break` inside a nested loop expecting to exit both | `break` exits only the innermost loop; use a flag or a function with `return` |

### 9.4 Suggested learning path

1. Complete the *Try It* section the same day you read each chapter.
2. Do the homework within 48 hours; redo the ones you struggled with after a week.
3. Take the assessment test without notes and review wrong answers by chapter.
4. Build the Guessing Game in levels, then add at least two extensions.
5. Next module: **Methods and Functions**. The `feedback` and `get_guess` functions in the capstone are your preview.

---

*End of document.*
