# Methods and Functions

> The third module of the Python course: how to **reuse** code. You will learn how to use the methods that belong to objects, write your own functions, use `lambda`, `map`, and `filter`, understand variable **scope**, and write flexible functions with `*args` and `**kwargs`. The module ends with a graded homework set and full solutions.

**Level:** Beginner → Intermediate
**Prerequisites:** Module 1 (*Objects and Data Structures*) and Module 2 (*Statements*)
**Requirements:** Python 3.10+
**Estimated time:** 14–18 hours (reading + practice + homework)

---

## Table of Contents

1. [Methods](#1-methods)
2. [Functions](#2-functions)
3. [Lambda Expressions, Map, and Filter](#3-lambda-expressions-map-and-filter)
4. [Nested Statements and Scope](#4-nested-statements-and-scope)
5. [`*args` and `**kwargs`](#5-args-and-kwargs)
6. [Functions and Methods Homework](#6-functions-and-methods-homework)
7. [Appendix: Cheat Sheet and Common Mistakes](#7-appendix)

> **How to use this document:** type every example yourself, predict the output *before* running it, then do the **Try It** exercises. Homework problems are collected in Section 6 (with solutions at the end) and each is tagged with the chapter it practices.

---

## 1. Methods

### 1.1 Learning goals
- Explain what an **object** and a **method** are
- Call methods and read their documentation with `dir()` and `help()`
- Know which methods **change** an object and which **return a new** one
- Chain methods safely
- See what a method looks like when you define one (a preview of classes)

### 1.2 Objects, attributes, and methods

In Python, **everything is an object**: numbers, strings, lists, even functions. An object bundles **data** with **behavior**:

- **Attributes** are data stored in the object (e.g., `account.balance`).
- **Methods** are functions that belong to the object and are called with a dot: `object.method(arguments)`.

```python
name = "python"
print(name.upper())          # PYTHON      <- method call
print(len(name))             # 6           <- function call (not a method)

numbers = [3, 1, 2]
numbers.append(4)            # method that changes the list
print(numbers)               # [3, 1, 2, 4]
```

| | Function | Method |
|---|---|---|
| Call style | `len(x)`, `sorted(x)` | `x.append(1)`, `s.upper()` |
| Belongs to | Nobody (stand-alone) | An object / type |
| Receives the object as | An explicit argument | An implicit first argument (`self`) |

### 1.3 Discovering what an object can do

```python
# 1. List the available names
print([m for m in dir(str) if not m.startswith("_")][:5])
# ['capitalize', 'casefold', 'center', 'count', 'encode']

# 2. Read the documentation
help(str.split)          # press q to leave on some terminals
print(str.split.__doc__)

# 3. Ask about types
print(type(3.5))                     # <class 'float'>
print(isinstance("abc", str))        # True
print(callable(len))                 # True
```

`dir()` + `help()` are the fastest way to learn a type without leaving your editor.

### 1.4 Mutating vs. non-mutating methods

This is the **most important** idea about methods:

- **Immutable types** (`str`, `tuple`, `int`): methods **return a new object**; the original never changes.
- **Mutable types** (`list`, `dict`, `set`): many methods **change the object in place** and return `None`.

```python
# str: returns a new string
s = "hello"
t = s.upper()
print(s, t)            # hello HELLO

# list: changes in place, returns None
nums = [3, 1, 2]
result = nums.sort()
print(result, nums)    # None [1, 2, 3]       <- classic trap!

# list: sorted() returns a NEW list
original = [3, 1, 2]
new = sorted(original)
print(original, new)   # [3, 1, 2] [1, 2, 3]
```

| Type | Changes the object (returns `None` unless noted) | Returns something new |
|---|---|---|
| `list` | `append`, `extend`, `insert`, `remove`, `sort`, `reverse`, `clear`, `pop` *(returns the removed item)* | `copy`, `index`, `count` |
| `dict` | `update`, `clear`, `setdefault` *(returns value)*, `pop` *(returns value)* | `get`, `keys`, `values`, `items`, `copy` |
| `set` | `add`, `remove`, `discard`, `update`, `clear` | `union`, `intersection`, `difference`, `copy` |
| `str` | *(none: strings are immutable)* | `upper`, `lower`, `strip`, `split`, `replace`, `join`, ... |
| `tuple` | *(none)* | `count`, `index` |

### 1.5 Method chaining

Because string methods return strings, you can chain them left to right:

```python
raw = "  Hello World  "
clean = raw.strip().lower().replace("o", "0")
print(clean)           # hell0 w0rld

words = "  the QUICK brown Fox ".strip().title().split()
print(words)           # ['The', 'Quick', 'Brown', 'Fox']
```

**Do not chain methods that return `None`:**

```python
items = []
# items.append(1).append(2)     # AttributeError: 'NoneType' object has no attribute 'append'
items.append(1)
items.append(2)
```

### 1.6 Methods you will use all the time

**Strings**

| Method | Example | Result |
|---|---|---|
| `split(sep)` / `rsplit(sep, n)` | `"a-b-c".rsplit("-", 1)` | `['a-b', 'c']` |
| `partition(sep)` | `"key=value".partition("=")` | `('key', '=', 'value')` |
| `splitlines()` | `"l1\nl2".splitlines()` | `['l1', 'l2']` |
| `join(iterable)` | `",".join(map(str, [1, 2, 3]))` | `'1,2,3'` |
| `center / ljust / rjust` | `"hi".center(6, "-")` | `'--hi--'` |
| `zfill(n)` | `"42".zfill(5)` | `'00042'` |
| `swapcase()` | `"Hello".swapcase()` | `'hELLO'` |
| `removeprefix / removesuffix` | `"file.txt".removesuffix(".txt")` | `'file'` |
| `isdigit / isalpha / isalnum / isspace` | `"123".isdigit()` | `True` |

**Lists**

```python
fruits = ["apple", "banana"]
fruits.extend(["cherry", "date"])    # add many
fruits.insert(1, "avocado")
removed = fruits.pop()               # 'date'
fruits.remove("banana")
fruits.sort(key=len, reverse=True)
print(fruits)                        # ['avocado', 'cherry', 'apple']
```

**Dictionaries**

```python
stock = {"apple": 5, "pear": 2}
stock.update({"fig": 8})
stock.setdefault("kiwi", 0)          # adds only if missing
sold = stock.pop("pear")             # 2
print(stock.get("mango", "n/a"))     # n/a
for item, qty in stock.items():
    print(f"{item:<6}{qty:>3}")
```

**Sets**

```python
tags = {"python", "code"}
tags.add("learn")
tags.discard("missing")              # no error
print(tags & {"python", "sql"})      # {'python'}
```

### 1.7 A first look at *defining* methods (preview of classes)

A method is just a function defined inside a **class**. Its first parameter, `self`, is the object the method is called on.

```python
class BankAccount:
    def __init__(self, owner, balance=0):     # runs when the object is created
        self.owner = owner                    # attributes
        self.balance = balance

    def deposit(self, amount):                # a method
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self.balance -= amount
        return self.balance

account = BankAccount("Sara", 100)
print(account.deposit(50))     # 150
print(account.withdraw(30))    # 120
print(account.owner, account.balance)   # Sara 120
```

`account.deposit(50)` is automatically translated to `BankAccount.deposit(account, 50)`. That is why `self` exists. Classes get their own module later.

### 1.8 Practical examples

**Example 1 – Text cleaning pipeline**
```python
def slugify(title):
    cleaned = "".join(ch if ch.isalnum() else " " for ch in title.lower())
    return "-".join(cleaned.split())

print(slugify("  Hello World! Python 101  "))   # hello-world-python-101
```

**Example 2 – Parsing a log line**
```python
line = "2026-10-15 ERROR Disk is full"
date, level, message = line.split(" ", 2)
print(date, level, message, sep=" | ")    # 2026-10-15 | ERROR | Disk is full
```

**Example 3 – Parsing `key=value` settings**
```python
config_text = "host=localhost\nport=8080\ndebug=true"
config = {}
for line in config_text.splitlines():
    key, _, value = line.partition("=")
    config[key.strip()] = value.strip()
print(config)    # {'host': 'localhost', 'port': '8080', 'debug': 'true'}
```

**Example 4 – Word frequency using dictionary methods**
```python
text = "to be or not to be"
freq = {}
for word in text.split():
    freq[word] = freq.get(word, 0) + 1
print(freq)      # {'to': 2, 'be': 2, 'or': 1, 'not': 1}
```

**Example 5 – In-place vs. new list: a safe sorting helper**
```python
scores = [17, 12, 19, 15]
ranking = sorted(scores, reverse=True)   # scores is untouched
print(scores)     # [17, 12, 19, 15]
print(ranking)    # [19, 17, 15, 12]
```

**Example 6 – To-do list with list methods**
```python
todo = ["email", "report"]
todo.append("gym")
todo.insert(0, "wake up")
done = todo.pop(1)           # 'email'
print(done, todo)            # email ['wake up', 'report', 'gym']
```

### 1.9 Try It
1. Without running it, predict the output: `x = [1, 2]; y = x.append(3); print(x, y)`.
2. Use `dir()` to find three `dict` methods you have not used yet, then read their `help()`.
3. Turn `"  ali REZA karimi  "` into `"Ali Reza Karimi"` with one chained expression.
4. Why does `"abc".upper()` not change the variable `s` in `s = "abc"; s.upper()`?
5. Add a `balance_report()` method to `BankAccount` that returns `"Sara: 120.00"`.

*Homework for this chapter: problems **W2, W4, W5, W8, I3, I4** in Section 6.*

---

## 2. Functions

### 2.1 Learning goals
- Define and call functions with `def`
- Use parameters, arguments, default values, and keyword arguments
- Return one or many values (and understand `None`)
- Document functions with docstrings and type hints
- Avoid the mutable-default trap and understand basic recursion

### 2.2 Why functions?

A function is a **named, reusable block of code**. They help you:

| Benefit | Meaning |
|---|---|
| **DRY** | Don't Repeat Yourself: write once, use everywhere |
| **Readability** | `calculate_tax(price)` explains itself |
| **Testability** | Small pieces can be tested individually |
| **Abstraction** | Use a function without knowing how it works inside |

### 2.3 Syntax

```python
def function_name(parameter1, parameter2):
    """Short description (docstring)."""
    # body
    return result
```

```python
def say_hello():
    print("Hello!")

say_hello()               # Hello!

def add(a, b):
    return a + b

total = add(3, 4)
print(total)              # 7
```

- **Parameters** are the names in the `def` line (`a`, `b`).
- **Arguments** are the actual values you pass in (`3`, `4`).
- Defining a function does **not** run it. You must **call** it.

### 2.4 `return` vs. `print`

```python
def square_print(n):
    print(n * n)          # shows the value, returns None

def square_return(n):
    return n * n          # hands the value back to the caller

a = square_print(4)       # prints 16
b = square_return(4)      # prints nothing
print(a, b)               # None 16
```

> **Rule of thumb:** functions should usually **return** results; printing is for the part of your program that talks to the user.

A function without a `return` returns `None`. Once `return` runs, the function ends immediately:

```python
def sign(n):
    if n > 0:
        return "positive"
    if n < 0:
        return "negative"
    return "zero"              # reached only for n == 0
```

### 2.5 Default values and keyword arguments

```python
def greet(name="friend", punctuation="!"):
    return f"Hello, {name}{punctuation}"

print(greet())                              # Hello, friend!
print(greet("Sara"))                        # Hello, Sara!
print(greet("Ali", "?"))                    # Hello, Ali?
print(greet(punctuation=".", name="Reza"))  # Hello, Reza.   (keyword arguments: any order)
```

Rules:
1. Parameters with defaults must come **after** those without.
2. Positional arguments come **before** keyword arguments in a call.

```python
# def bad(a=1, b):    # SyntaxError: non-default argument follows default argument
```

### 2.6 Returning multiple values

Python returns a **tuple**, which you can unpack:

```python
def min_max_mean(values):
    return min(values), max(values), sum(values) / len(values)

low, high, mean = min_max_mean([4, 8, 15, 16, 23, 42])
print(low, high, round(mean, 2))    # 4 42 18.0
```

### 2.7 Docstrings and type hints

```python
def area_of_circle(radius: float) -> float:
    """Return the area of a circle.

    Args:
        radius: The circle radius (must be >= 0).

    Raises:
        ValueError: If radius is negative.
    """
    if radius < 0:
        raise ValueError("radius must be >= 0")
    return 3.141592653589793 * radius ** 2

print(area_of_circle(2))                # 12.566370614359172
print(area_of_circle.__doc__[:28])      # Return the area of a circle.
help(area_of_circle)
```

- A **docstring** (first string in the function) is what `help()` shows.
- **Type hints** (`radius: float`, `-> float`) are documentation for people and tools; Python does **not** enforce them at runtime.

### 2.7.1 Validating arguments

```python
def divide(a, b):
    if b == 0:
        raise ZeroDivisionError("b must not be zero")
    return a / b

try:
    divide(5, 0)
except ZeroDivisionError as error:
    print("Error:", error)             # Error: b must not be zero
```

### 2.8 Functions are objects

You can store functions in variables, put them in lists, pass them to other functions, and return them.

```python
def shout(text):
    return text.upper() + "!"

def whisper(text):
    return text.lower() + "..."

def apply(func, value):
    return func(value)

print(apply(shout, "Hello"))        # HELLO!
print(apply(whisper, "Hello"))      # hello...

styles = [shout, whisper, str.title]
print([f("pyThon") for f in styles])   # ['PYTHON!', 'python...', 'Python']
```

### 2.9 The mutable default argument trap

Default values are created **once**, when the function is defined, not on every call.

```python
def add_item(item, bag=[]):         # DANGEROUS
    bag.append(item)
    return bag

print(add_item("a"))    # ['a']
print(add_item("b"))    # ['a', 'b']   <-- surprise! same list reused

def add_item_safe(item, bag=None):  # CORRECT
    if bag is None:
        bag = []
    bag.append(item)
    return bag

print(add_item_safe("a"))   # ['a']
print(add_item_safe("b"))   # ['b']
```

**Rule:** never use `[]`, `{}`, or `set()` as a default. Use `None` and create the object inside.

### 2.10 Side effects and pure functions

```python
# Impure: changes the list passed in (side effect)
def add_tax_in_place(prices, rate):
    for i in range(len(prices)):
        prices[i] *= 1 + rate

# Pure: returns a new list, leaves the input alone
def with_tax(prices, rate):
    return [round(p * (1 + rate), 2) for p in prices]

original = [100, 200]
print(with_tax(original, 0.1))   # [110.0, 220.0]
print(original)                  # [100, 200]
```

Prefer pure functions whenever possible: they are easier to test and reason about. If a function *does* modify its argument, say so in the name or docstring.

### 2.11 Recursion (a function that calls itself)

A recursive function needs a **base case** (stop) and a **recursive case** (smaller problem).

```python
def factorial(n):
    if n <= 1:              # base case
        return 1
    return n * factorial(n - 1)    # recursive case

print(factorial(5))         # 120

def sum_digits(n):
    return n if n < 10 else n % 10 + sum_digits(n // 10)

print(sum_digits(90517))    # 22

def countdown(n):
    if n == 0:
        print("Liftoff!")
        return
    print(n)
    countdown(n - 1)
```

Python limits recursion depth (about 1000 calls by default; see `sys.getrecursionlimit()`). For deep problems, prefer loops. Caching with `functools.lru_cache` makes repeated recursion fast:

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(50))      # 12586269025
```

### 2.12 Writing good functions: a checklist

1. **One job** per function.
2. **Verb names** in `snake_case` (`calculate_tax`, `is_prime`, `load_users`).
3. Booleans start with `is_`, `has_`, `can_`.
4. Keep functions short (a screen or less).
5. Return values; don't print (unless printing *is* the job).
6. Write a docstring for anything non-obvious.
7. Test with a few `assert` statements.

```python
def is_even(n):
    return n % 2 == 0

assert is_even(4)
assert not is_even(7)
```

If an `assert` fails, Python raises `AssertionError`. Silence means your tests passed.

### 2.13 Practical examples

**Example 1 – Temperature converter**
```python
def c_to_f(celsius):
    return celsius * 9 / 5 + 32

def f_to_c(fahrenheit):
    return (fahrenheit - 32) * 5 / 9

print(c_to_f(100))             # 212.0
print(round(f_to_c(98.6), 1))  # 37.0
```

**Example 2 – BMI with category**
```python
def bmi_report(weight_kg, height_m):
    bmi = weight_kg / height_m ** 2
    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25:
        category = "Normal"
    elif bmi < 30:
        category = "Overweight"
    else:
        category = "Obese"
    return round(bmi, 1), category

print(bmi_report(82, 1.75))    # (26.8, 'Overweight')
```

**Example 3 – Prime numbers**
```python
def is_prime(n):
    if n < 2:
        return False
    for d in range(2, int(n ** 0.5) + 1):
        if n % d == 0:
            return False
    return True

def primes_up_to(limit):
    return [n for n in range(2, limit + 1) if is_prime(n)]

print(primes_up_to(30))   # [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
```

**Example 4 – Shopping cart total**
```python
def cart_total(prices, tax_rate=0.09, discount=0.0):
    subtotal = sum(prices)
    discounted = subtotal * (1 - discount)
    return round(discounted * (1 + tax_rate), 2)

print(cart_total([20, 30, 50]))                 # 109.0
print(cart_total([20, 30, 50], discount=0.1))   # 98.1
```

**Example 5 – Pig Latin**
```python
def pig_latin(word):
    word = word.lower()
    if word[0] in "aeiou":
        return word + "way"
    for i, letter in enumerate(word):
        if letter in "aeiou":
            return word[i:] + word[:i] + "ay"
    return word + "ay"

print(pig_latin("apple"))     # appleway
print(pig_latin("string"))    # ingstray
print(pig_latin("python"))    # onpythay
```

**Example 6 – FizzBuzz as a function**
```python
def fizzbuzz(n):
    result = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            result.append("FizzBuzz")
        elif i % 3 == 0:
            result.append("Fizz")
        elif i % 5 == 0:
            result.append("Buzz")
        else:
            result.append(str(i))
    return result

print(fizzbuzz(15)[-3:])      # ['13', '14', 'FizzBuzz']
```

**Example 7 – Password check returning a verdict and reasons**
```python
def check_password(password):
    problems = []
    if len(password) < 8:
        problems.append("too short")
    if not any(c.isdigit() for c in password):
        problems.append("needs a digit")
    if password.islower() or password.isupper():
        problems.append("needs mixed case")
    return (len(problems) == 0), problems

print(check_password("abc"))          # (False, ['too short', 'needs a digit', 'needs mixed case'])
print(check_password("Python2026"))   # (True, [])
```

**Example 8 – A small "bank" built from functions**
```python
def deposit(balance, amount):
    if amount <= 0:
        raise ValueError("Deposit must be positive")
    return balance + amount

def withdraw(balance, amount):
    if amount > balance:
        raise ValueError("Insufficient funds")
    return balance - amount

balance = 100
balance = deposit(balance, 50)
balance = withdraw(balance, 30)
print(balance)    # 120
```

**Example 9 – Splitting a bill**
```python
def split_bill(total, people, tip_percent=10):
    total_with_tip = total * (1 + tip_percent / 100)
    return round(total_with_tip / people, 2)

print(split_bill(120, 4))        # 33.0
print(split_bill(120, 4, 20))    # 36.0
```

### 2.14 Try It
1. Write `is_leap(year)` that returns a boolean, then test 1900, 2000, 2024, 2026 with `assert`.
2. What does this print, and why?
   ```python
   def f(x):
       x = x + 1
   y = f(1)
   print(y)
   ```
3. Write `average(numbers)` that returns `None` for an empty list instead of crashing.
4. Rewrite `factorial` with a loop instead of recursion.
5. Fix: `def log(message, history=[]): history.append(message); return history`.

*Homework for this chapter: problems **W1, W3, W6, W7, W9, W10, I1, I2, I10** in Section 6.*

---

## 3. Lambda Expressions, Map, and Filter

### 3.1 Learning goals
- Write small anonymous functions with `lambda`
- Use `map()`, `filter()`, and `functools.reduce()`
- Pass `lambda` as a `key=` argument to `sorted`, `min`, `max`
- Decide between lambdas, comprehensions, and normal functions

### 3.2 Lambda expressions

A **lambda** is a small, anonymous, single-expression function.

```python
# These two are equivalent
def square(x):
    return x * x

square = lambda x: x * x      # works, but PEP 8 prefers `def` when you give it a name

print(square(5))              # 25
```

**Syntax:** `lambda parameters: expression`

- No `return` keyword (the expression's value *is* returned).
- Only **one expression**: no statements like `if` blocks, loops, or assignments.

```python
add = lambda a, b: a + b
greet = lambda name="you": f"Hi {name}"
is_even = lambda n: n % 2 == 0
bigger = lambda a, b: a if a > b else b       # conditional expression is fine

print(add(2, 3), greet(), is_even(10), bigger(3, 9))   # 5 Hi you True 9

print((lambda x: x * 10)(4))   # 40 (called immediately; rarely useful)
```

**Where lambdas shine:** short throw-away functions passed to other functions.

### 3.3 Lambdas as `key=` functions

```python
students = [("Ali", 17), ("Sara", 20), ("Reza", 17)]

# Sort by score (descending), then name (ascending)
print(sorted(students, key=lambda s: (-s[1], s[0])))
# [('Sara', 20), ('Ali', 17), ('Reza', 17)]

words = ["banana", "fig", "cherry", "kiwi"]
print(sorted(words, key=lambda w: (len(w), w)))     # ['fig', 'kiwi', 'banana', 'cherry']
print(max(words, key=lambda w: w[-1]))              # cherry (last letters a, g, y, i: 'y' is largest)
print(min(students, key=lambda s: s[1]))            # ('Ali', 17) (first of the minimums)
```

### 3.4 `map()`: apply a function to every item

`map(function, iterable)` returns an **iterator** (lazy). Wrap it in `list()` to see the values.

```python
nums = [1, 2, 3, 4]

print(list(map(lambda n: n ** 2, nums)))          # [1, 4, 9, 16]
print(list(map(str, nums)))                       # ['1', '2', '3', '4']
print(list(map(len, ["a", "bb", "ccc"])))         # [1, 2, 3]
print(list(map(str.upper, ["a", "b"])))           # ['A', 'B']

# Several iterables at once
print(list(map(lambda a, b: a * b, [1, 2, 3], [4, 5, 6])))   # [4, 10, 18]

# Common input trick
# numbers = list(map(int, input("Numbers: ").split()))
```

A `map` object can be consumed **only once**:

```python
m = map(abs, [-1, -2])
print(list(m))    # [1, 2]
print(list(m))    # []   (exhausted)
```

### 3.5 `filter()`: keep items that pass a test

`filter(function, iterable)` keeps items for which the function returns a truthy value.

```python
nums = range(10)
print(list(filter(lambda n: n % 2, nums)))            # [1, 3, 5, 7, 9]
print(list(filter(str.isdigit, ["12", "ab", "7"])))   # ['12', '7']

# filter(None, ...) removes falsy values
print(list(filter(None, [0, 1, "", None, "a", []])))  # [1, 'a']
```

### 3.6 `reduce()`: combine all items into one value

`reduce` lives in `functools`. It applies a two-argument function cumulatively.

```python
from functools import reduce

print(reduce(lambda a, b: a + b, [1, 2, 3, 4]))          # 10
print(reduce(lambda a, b: a * b, [1, 2, 3, 4, 5]))       # 120
print(reduce(lambda a, b: a + b, [1, 2, 3, 4], 100))     # 110 (initial value)
print(reduce(lambda a, b: a if a > b else b, [3, 9, 2])) # 9
```

For sums and maximums, the built-ins `sum()` and `max()` are clearer; `reduce` is for custom combining.

### 3.7 Lambda vs. comprehension vs. `def`

```python
nums = [1, 2, 3, 4, 5, 6]

# Three ways to get the squares of the even numbers
a = list(map(lambda n: n ** 2, filter(lambda n: n % 2 == 0, nums)))
b = [n ** 2 for n in nums if n % 2 == 0]       # usually the most readable

def even_square(n):
    return n ** 2
c = [even_square(n) for n in nums if n % 2 == 0]

print(a == b == c, b)        # True [4, 16, 36]
```

| Choose... | When |
|---|---|
| **Comprehension** | Simple transform/filter on a collection (the default choice) |
| **`map`/`filter` + built-in or named function** | You already have a function (`map(int, ...)`, `filter(str.isdigit, ...)`) |
| **`lambda`** | A tiny one-off function, especially for `key=` |
| **`def`** | Anything longer, reused, or needing a docstring/statements |

### 3.8 Lambda gotcha: late binding

```python
funcs = [lambda: i for i in range(3)]
print([f() for f in funcs])        # [2, 2, 2]   <-- all see the final i

funcs = [lambda i=i: i for i in range(3)]    # capture the current i as a default
print([f() for f in funcs])        # [0, 1, 2]
```

### 3.9 Dispatch tables and `functools.partial`

```python
import operator
from functools import partial

# A calculator without a long if/elif chain
ops = {
    "+": operator.add,
    "-": operator.sub,
    "*": operator.mul,
    "/": lambda a, b: a / b if b != 0 else None,
}
print(ops["*"](6, 7))      # 42
print(ops["/"](1, 0))      # None

# partial: fix some arguments of an existing function
def power(base, exp):
    return base ** exp

square = partial(power, exp=2)
cube = partial(power, exp=3)
print(square(5), cube(2))  # 25 8
```

### 3.10 Practical examples

**Example 1 – Sort records by multiple fields**
```python
employees = [
    {"name": "Ali", "dept": "IT", "salary": 4200},
    {"name": "Sara", "dept": "HR", "salary": 3900},
    {"name": "Reza", "dept": "IT", "salary": 5100},
]
by_dept_then_salary = sorted(employees, key=lambda e: (e["dept"], -e["salary"]))
print([e["name"] for e in by_dept_then_salary])   # ['Sara', 'Reza', 'Ali']
```

**Example 2 – Convert and clean data**
```python
raw = ["  Ali ", "SARA", " reza  "]
print(list(map(lambda s: s.strip().title(), raw)))     # ['Ali', 'Sara', 'Reza']
```

**Example 3 – Total price with `map` and `sum`**
```python
cart = [("pen", 3, 1.5), ("book", 2, 12.0), ("bag", 1, 30.0)]
total = sum(map(lambda item: item[1] * item[2], cart))
print(total)      # 58.5
```

**Example 4 – Filter records**
```python
temperatures = {"Tehran": 31, "Tabriz": 22, "Ahvaz": 44, "Rasht": 25}
hot = dict(filter(lambda kv: kv[1] > 30, temperatures.items()))
print(hot)        # {'Tehran': 31, 'Ahvaz': 44}
```

**Example 5 – Flatten using `reduce`**
```python
from functools import reduce
nested = [[1, 2], [3], [4, 5]]
print(reduce(lambda acc, sub: acc + sub, nested, []))    # [1, 2, 3, 4, 5]
```

**Example 6 – Strongest word per length**
```python
words = ["tree", "apple", "sky", "river", "owl"]
longest = max(words, key=len)
shortest = min(words, key=len)
print(longest, shortest)      # apple sky
```

**Example 7 – Pipeline of transformations**
```python
pipeline = [str.strip, str.lower, lambda s: s.replace(" ", "_")]
text = "  My Variable Name  "
for step in pipeline:
    text = step(text)
print(text)       # my_variable_name
```

### 3.11 Try It
1. Use `map` and `lambda` to convert `[0, 37, 100]` degrees Celsius to Fahrenheit.
2. Use `filter` to keep names longer than 3 letters from `["Ali", "Sara", "Reza", "Om"]`.
3. Use `reduce` to compute the product of `range(1, 8)`.
4. Rewrite example 3.10-3 using a comprehension. Which do you find more readable?
5. Predict, then check: `sorted(["b", "A", "c"], key=str.lower)`.

*Homework for this chapter: problems **I5, I8, C3** in Section 6.*

---

## 4. Nested Statements and Scope

### 4.1 Learning goals
- Read and write nested statements (loops/conditions inside functions)
- Explain Python's **LEGB** name-resolution rule
- Use `global` and `nonlocal` correctly (and know when **not** to)
- Create **closures** (functions that remember their environment)

### 4.2 Nested statements and blocks

You can nest `if`, `for`, `while`, `try`, and `def` inside each other. Each level adds 4 spaces of indentation.

```python
def classify_numbers(numbers):
    result = {"even": [], "odd": [], "negative": []}
    for n in numbers:
        if n < 0:
            result["negative"].append(n)
        else:
            if n % 2 == 0:
                result["even"].append(n)
            else:
                result["odd"].append(n)
    return result

print(classify_numbers([4, -1, 7, 10, 3]))
# {'even': [4, 10], 'odd': [7, 3], 'negative': [-1]}
```

**Important:** Python has **no block scope**. `if`, `for`, and `while` blocks do **not** create new scopes; only **functions** (and classes, modules, comprehensions) do.

```python
for i in range(3):
    last = i * 10

print(i, last)        # 2 20   <- loop variables survive after the loop
```

### 4.3 What is scope?

**Scope** is the region of code where a name (variable) can be seen. When Python meets a name, it searches in this order, called **LEGB**:

| Letter | Scope | Where |
|---|---|---|
| **L** | Local | Inside the current function |
| **E** | Enclosing | Inside any outer function that contains this one |
| **G** | Global | At the top level of the module (file) |
| **B** | Built-in | Names Python provides (`len`, `print`, `sum`, ...) |

```python
x = "global"

def outer():
    x = "enclosing"

    def inner():
        x = "local"
        print(x)           # local

    inner()
    print(x)               # enclosing

outer()
print(x)                   # global
```

If a name is not local, Python looks outward; it never looks **inward** (a function's local names are invisible to the outside).

```python
def make_secret():
    secret = 42

make_secret()
# print(secret)        # NameError: name 'secret' is not defined
```

### 4.4 Reading vs. assigning

A function may **read** a global variable freely, but **assigning** to a name inside a function makes it **local** for the whole function:

```python
rate = 0.09

def price_with_tax(price):
    return round(price * (1 + rate), 2)     # reading the global: fine

print(price_with_tax(100))        # 109.0

count = 0

def increment():
    count += 1                    # UnboundLocalError!
    # Python sees an assignment, so `count` is local; reading it before assignment fails

# increment()
```

### 4.5 The `global` keyword

```python
visits = 0

def record_visit():
    global visits         # "I mean the module-level variable"
    visits += 1

record_visit()
record_visit()
print(visits)             # 2
```

Use `global` **sparingly**. Global state makes code hard to test and debug. Prefer parameters and return values:

```python
def record_visit_pure(visits):
    return visits + 1

visits = 0
visits = record_visit_pure(visits)
```

*Constants* (`TAX_RATE = 0.09`) at module level are perfectly fine because they are never reassigned.

### 4.6 Closures and the `nonlocal` keyword

A **closure** is an inner function that **remembers** variables from its enclosing function, even after the outer function has finished.

```python
def make_multiplier(factor):
    def multiply(x):
        return x * factor      # `factor` comes from the enclosing scope
    return multiply

double = make_multiplier(2)
triple = make_multiplier(3)
print(double(10), triple(10))  # 20 30
```

To **reassign** an enclosing variable from an inner function, use `nonlocal`:

```python
def make_counter(start=0, step=1):
    count = start

    def counter():
        nonlocal count
        count += step
        return count

    return counter

c = make_counter()
print(c(), c(), c())           # 1 2 3

by_five = make_counter(10, 5)
print(by_five(), by_five())    # 15 20
print(c())                     # 4   (each counter keeps its own state)
```

| Keyword | Refers to | Use |
|---|---|---|
| `global x` | Module-level `x` | Rare |
| `nonlocal x` | `x` in the nearest enclosing *function* | Closures |

### 4.7 Shadowing built-ins and names

```python
def total_length(words):
    sum = 0                       # DANGER: shadows the built-in sum()
    for w in words:
        sum += len(w)
    return sum

print(total_length(["ab", "cde"]))    # 5 (works here...)

list = [1, 2, 3]                      # shadows the built-in list
# list("abc")                         # TypeError: 'list' object is not callable
del list                              # remove the shadow; built-in works again
print(list("abc"))                    # ['a', 'b', 'c']
```

Choose descriptive names (`total`, `items`) and never reuse `list`, `dict`, `str`, `sum`, `max`, `min`, `id`, `input`.

### 4.8 Comprehension scope

Variables inside a comprehension are local to it:

```python
squares = [j ** 2 for j in range(3)]
# print(j)         # NameError: j is not defined (unlike a for loop!)
```

### 4.9 Scope puzzles: predict first

**Puzzle 1**
```python
x = 10
def show():
    print(x)
show()
```
Output: `10` (reads the global).

**Puzzle 2**
```python
x = 10
def change():
    x = 20
    print(x)
change()
print(x)
```
Output: `20` then `10` (the function's `x` is a different, local variable).

**Puzzle 3**
```python
def f():
    total = 0
    for i in range(3):
        total += i
    return total, i
print(f())
```
Output: `(3, 2)` (no block scope: `i` survives the loop).

**Puzzle 4**
```python
def outer():
    items = []
    def add(x):
        items.append(x)       # mutating, not reassigning, so no `nonlocal` needed
    add(1); add(2)
    return items
print(outer())
```
Output: `[1, 2]`.

**Puzzle 5**
```python
def outer():
    n = 0
    def bump():
        n += 1
    bump()
    return n
# outer()  -> UnboundLocalError (need `nonlocal n`)
```

### 4.10 Practical examples

**Example 1 – Configurable tax calculator (closure)**
```python
def make_tax_calculator(rate):
    def calculate(price):
        return round(price * (1 + rate), 2)
    return calculate

vat_9 = make_tax_calculator(0.09)
vat_20 = make_tax_calculator(0.20)
print(vat_9(200), vat_20(200))     # 218.0 240.0
```

**Example 2 – Validator factory**
```python
def make_range_validator(low, high):
    def validate(value):
        return low <= value <= high
    return validate

is_valid_age = make_range_validator(0, 120)
is_valid_score = make_range_validator(0, 20)
print(is_valid_age(35), is_valid_score(25))    # True False
```

**Example 3 – Private state with a closure (bank account)**
```python
def make_account(balance=0):
    def deposit(amount):
        nonlocal balance
        balance += amount
        return balance

    def withdraw(amount):
        nonlocal balance
        if amount > balance:
            raise ValueError("Insufficient funds")
        balance -= amount
        return balance

    def get_balance():
        return balance

    return deposit, withdraw, get_balance

deposit, withdraw, get_balance = make_account(100)
deposit(50)
withdraw(30)
print(get_balance())    # 120
```

**Example 4 – Simple cache (memoization) with a closure**
```python
def make_cached_square():
    cache = {}
    def square(n):
        if n not in cache:
            print(f"computing {n}")
            cache[n] = n * n
        return cache[n]
    return square

sq = make_cached_square()
print(sq(4))    # computing 4  -> 16
print(sq(4))    # 16 (from cache, no "computing" line)
```

**Example 5 – Nested loops with early exit via a function**
```python
def find_pair(numbers, target):
    for i in range(len(numbers)):
        for j in range(i + 1, len(numbers)):
            if numbers[i] + numbers[j] == target:
                return numbers[i], numbers[j]     # leaves BOTH loops at once
    return None

print(find_pair([2, 7, 11, 15], 18))    # (7, 11)
print(find_pair([1, 2, 3], 10))         # None
```

**Example 6 – A running logger**
```python
def make_logger(prefix):
    messages = []
    def log(text=None):
        if text is not None:
            messages.append(f"[{prefix}] {text}")
        return list(messages)
    return log

log = make_logger("APP")
log("start")
log("working")
print(log())     # ['[APP] start', '[APP] working']
```

### 4.11 Try It
1. Predict the output:
   ```python
   a = 1
   def f():
       a = 2
       def g():
           print(a)
       g()
   f()
   print(a)
   ```
2. Fix `increment()` in 4.4 two ways: with `global`, and by passing and returning the value.
3. Why does `items.append(x)` inside an inner function work without `nonlocal`, but `items = items + [x]` does not?
4. Write `make_greeter(greeting)` so `make_greeter("Salam")("Ali")` returns `"Salam, Ali!"`.

*Homework for this chapter: problems **I5, I6, I7** in Section 6.*

---

## 5. `*args` and `**kwargs`

### 5.1 Learning goals
- Accept a variable number of positional arguments with `*args`
- Accept arbitrary keyword arguments with `**kwargs`
- Use `*` and `**` to **unpack** sequences and dictionaries in calls
- Define keyword-only and positional-only parameters
- Forward arguments to other functions (and write a simple decorator)

### 5.2 `*args`: any number of positional arguments

A parameter prefixed with `*` collects extra positional arguments into a **tuple**.

```python
def total(*numbers):
    print(type(numbers), numbers)
    return sum(numbers)

print(total())              # <class 'tuple'> ()           -> 0
print(total(5))             # <class 'tuple'> (5,)         -> 5
print(total(1, 2, 3, 4))    # <class 'tuple'> (1, 2, 3, 4) -> 10
```

The name `args` is a convention; `*numbers`, `*values`, etc. work. The `*` is what matters.

### 5.3 `**kwargs`: any number of keyword arguments

A parameter prefixed with `**` collects extra keyword arguments into a **dictionary**.

```python
def show_profile(**details):
    print(type(details))                # <class 'dict'>
    for key, value in details.items():
        print(f"{key}: {value}")

show_profile(name="Sara", age=24, city="Tehran")
# name: Sara
# age: 24
# city: Tehran
```

### 5.4 Combining everything: the parameter order

```python
def example(a, b=2, *args, c=3, **kwargs):
    return a, b, args, c, kwargs

print(example(1))
# (1, 2, (), 3, {})
print(example(1, 10, 20, 30, c=5, d=6))
# (1, 10, (20, 30), 5, {'d': 6})
```

**Required order in a `def`:**

1. normal positional parameters (`a`)
2. parameters with defaults (`b=2`)
3. `*args`
4. keyword-only parameters (`c=3`)
5. `**kwargs`

### 5.5 Unpacking in a call: `*` and `**`

The same symbols work in the opposite direction when **calling** a function:

```python
def add3(a, b, c):
    return a + b + c

numbers = [1, 2, 3]
print(add3(*numbers))                  # 6   (same as add3(1, 2, 3))

values = {"a": 10, "b": 20, "c": 30}
print(add3(**values))                  # 60  (same as add3(a=10, b=20, c=30))

print(*[1, 2, 3], sep=", ")            # 1, 2, 3

defaults = {"theme": "light", "lang": "en"}
user = {"lang": "fa"}
print({**defaults, **user})            # {'theme': 'light', 'lang': 'fa'}
print([*range(3), *"ab"])              # [0, 1, 2, 'a', 'b']
```

### 5.5.1 Keyword-only and positional-only parameters

```python
# Keyword-only: everything after a bare * must be passed by name
def connect(host, *, port=80, timeout=5):
    return f"{host}:{port} (timeout {timeout}s)"

print(connect("example.com", port=8080))    # example.com:8080 (timeout 5s)
# connect("example.com", 8080)              # TypeError

# Positional-only: everything before / must be passed by position (Python 3.8+)
def power(base, exp, /):
    return base ** exp

print(power(2, 10))        # 1024
# power(base=2, exp=10)    # TypeError
```

Keyword-only parameters make calls self-documenting and prevent mixing up arguments.

### 5.6 Forwarding arguments and writing a decorator

`*args, **kwargs` lets a wrapper pass **anything** to another function:

```python
from functools import wraps

def logged(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__} with {args} {kwargs}")
        result = func(*args, **kwargs)
        print(f"{func.__name__} returned {result}")
        return result
    return wrapper

@logged
def add(a, b):
    return a + b

add(2, b=3)
# Calling add with (2,) {'b': 3}
# add returned 5
```

`@logged` above `def add` is shorthand for `add = logged(add)`. This is a **decorator**, one of the most powerful uses of closures plus `*args/**kwargs`.

### 5.7 Practical examples

**Example 1 – Average of any number of values**
```python
def average(*numbers):
    if not numbers:
        raise ValueError("average() needs at least one number")
    return sum(numbers) / len(numbers)

print(average(10, 20, 30))         # 20.0
```

**Example 2 – Print-like function**
```python
def my_print(*values, sep=" ", end="\n"):
    print(sep.join(map(str, values)), end=end)

my_print("a", 1, 2.5, sep="-")     # a-1-2.5
```

**Example 3 – HTML tag builder**
```python
def tag(name, *content, **attrs):
    attributes = "".join(f' {k.rstrip("_")}="{v}"' for k, v in attrs.items())
    return f"<{name}{attributes}>{''.join(map(str, content))}</{name}>"

print(tag("p", "Hello", class_="intro", id="x"))
# <p class="intro" id="x">Hello</p>
print(tag("br"))
# <br></br>
```
(`class` is a Python keyword, so the trailing underscore trick `class_` is a common convention.)

**Example 4 – Merge any number of dictionaries**
```python
def merge_dicts(*dicts):
    result = {}
    for d in dicts:
        result.update(d)
    return result

print(merge_dicts({"a": 1}, {"b": 2}, {"a": 99}))     # {'a': 99, 'b': 2}
```

**Example 5 – Report generator mixing both**
```python
def make_report(title, *items, **meta):
    lines = [title.upper(), "=" * len(title)]
    lines += [f"- {item}" for item in items]
    lines += [f"{key}: {value}" for key, value in meta.items()]
    return "\n".join(lines)

print(make_report("Sales", "North: 120", "South: 95", author="Sara", date="2026-10-15"))
# SALES
# =====
# - North: 120
# - South: 95
# author: Sara
# date: 2026-10-15
```

**Example 6 – `max_by` with a keyword-only `key`**
```python
def max_by(*items, key=None):
    return max(items, key=key)

print(max_by("a", "ccc", "bb", key=len))    # ccc
print(max_by(3, 9, 4))                      # 9
```

**Example 7 – Default settings overridden by the caller**
```python
def create_user(name, **options):
    settings = {"role": "member", "active": True}
    settings.update(options)
    return {"name": name, **settings}

print(create_user("Ali"))
# {'name': 'Ali', 'role': 'member', 'active': True}
print(create_user("Sara", role="admin"))
# {'name': 'Sara', 'role': 'admin', 'active': True}
```

**Example 8 – Spreading a list of records into a function**
```python
def full_name(first, last, title=""):
    return f"{title} {first} {last}".strip()

people = [("Sara", "Karimi"), ("Ali", "Rezaei")]
print([full_name(*p) for p in people])      # ['Sara Karimi', 'Ali Rezaei']
print(full_name(**{"first": "Reza", "last": "Moradi", "title": "Dr."}))   # Dr. Reza Moradi
```

### 5.8 Common mistakes

| Mistake | Problem | Fix |
|---|---|---|
| `def f(**kwargs, *args)` | Wrong order → `SyntaxError` | `def f(*args, **kwargs)` |
| Calling `f(list)` when you meant `f(*list)` | List passed as one argument | Unpack with `*` |
| Expecting `args` to be a list | It's a **tuple** (immutable) | `list(args)` if you need to change it |
| Forgetting `**` when passing a dict | `TypeError` | `f(**mydict)` |
| Duplicate keys: `f(a=1, **{"a": 2})` | `TypeError: multiple values` | Merge dicts first |

### 5.9 Try It
1. Write `product(*numbers)` returning the product (and `1` when empty).
2. Write `info(**kwargs)` that prints keys sorted alphabetically.
3. What does `example(1, 2, 3, d=4)` return using the function in 5.4?
4. Write a decorator `count_calls` that counts how many times a function was called and stores it in `wrapper.calls`.
5. Why does `print(*[1, 2, 3], sep="")` print `123`?

*Homework for this chapter: problems **I9, I10, C3, C4** in Section 6.*

---

## 6. Functions and Methods Homework

### How to work through this section
1. Read the problem, then write your own tests *before* the function (`assert` statements).
2. Write the function. Run your tests.
3. Only then compare with the solutions at the end of the section.
4. Every function must have a **docstring** and use **no global variables** (unless the problem says otherwise).

Problems are tagged with the chapter they practice: `[M]` Methods · `[F]` Functions · `[L]` Lambda/map/filter · `[S]` Scope · `[A]` args/kwargs.

---

### Level 1: Warm-ups

**W1 `[F]`: `larger_unless_both_even(a, b)`**
Return the **smaller** number if both are even; otherwise return the **larger**.
```python
larger_unless_both_even(2, 4)   # 2
larger_unless_both_even(2, 5)   # 5
larger_unless_both_even(3, 5)   # 5
```

**W2 `[M]`: `same_first_letter(sentence)`**
Return `True` if every word in the sentence starts with the same letter (ignore case); `False` otherwise, including for an empty sentence.
```python
same_first_letter("Peter picked purple peppers")   # True
same_first_letter("big dog")                       # False
```

**W3 `[F]`: `hits_target(a, b, target=20)`**
Return `True` if either number equals `target` or their sum equals `target`.
```python
hits_target(20, 5)    # True
hits_target(12, 8)    # True
hits_target(3, 4)     # False
```

**W4 `[M]`: `alternate_case(text)`**
Return the text with characters at even positions upper-case and odd positions lower-case.
```python
alternate_case("python")     # 'PyThOn'
```

**W5 `[M]`: `reverse_words(sentence)`**
Reverse the **order of the words**.
```python
reverse_words("I love Python")    # 'Python love I'
```

**W6 `[F]`: `near(n, targets=(100, 200), tolerance=10)`**
Return `True` if `n` is within `tolerance` of **any** target.
```python
near(93)       # True
near(150)      # False
near(209)      # True
```

**W7 `[F]`: `has_adjacent_pair(nums, value)`**
Return `True` if `value` appears **twice in a row** in `nums`.
```python
has_adjacent_pair([1, 3, 3], 3)    # True
has_adjacent_pair([3, 1, 3], 3)    # False
```

**W8 `[M]`: `repeat_letters(text, times=2)`**
Repeat each character `times` times.
```python
repeat_letters("Hello")        # 'HHeelllloo'
repeat_letters("ab", 3)        # 'aaabbb'
```

**W9 `[F]`: `hand_value(cards)`**
`cards` is a list of three integers from 1 to 11. Return their sum if it is **21 or less**. If it is over 21 and the hand contains an `11`, count **one** `11` as `1` (subtract 10) and return the new sum if that is 21 or less. Otherwise return the string `"BUST"`.
```python
hand_value([5, 6, 7])       # 18
hand_value([9, 9, 11])      # 19
hand_value([10, 10, 5])     # 'BUST'
```

**W10 `[F]`: `count_primes_upto(n)`**
Return how many prime numbers are `<= n`.
```python
count_primes_upto(10)     # 4
count_primes_upto(100)    # 25
```

---

### Level 2: Intermediate

**I1 `[F]`: `running_totals(nums)`**
```python
running_totals([1, 2, 3, 4])    # [1, 3, 6, 10]
running_totals([])              # []
```

**I2 `[F]`: `flatten_once(nested)`**
Flatten one level of nesting.
```python
flatten_once([[1, 2], [3], [], [4, 5]])    # [1, 2, 3, 4, 5]
```

**I3 `[M]`: `word_stats(text)`**
Return a dictionary with the keys `count`, `longest`, `average_length` (rounded to 2 decimals). Strip punctuation `.,!?;:"'()` from the ends of words and ignore empty words. For no words return `{"count": 0, "longest": None, "average_length": 0.0}`.
```python
word_stats("The quick brown fox.")
# {'count': 4, 'longest': 'quick', 'average_length': 4.0}
```

**I4 `[M]`: `is_anagram(a, b)`**
Ignore case and spaces.
```python
is_anagram("Dormitory", "Dirty room")    # True
is_anagram("hello", "world")             # False
```

**I5 `[L][S]`: `compose(f, g)`**
Return a **new function** `h` such that `h(x) == f(g(x))`.
```python
shout_clean = compose(str.upper, str.strip)
shout_clean("  hi ")      # 'HI'
```

**I6 `[S]`: `make_counter(start=0, step=1)`**
Return a function that, each time it is called, increases an internal count by `step` and returns it (using `nonlocal`).
```python
c = make_counter()
c(), c()           # (1, 2)
d = make_counter(10, 5)
d(), d()           # (15, 20)
```

**I7 `[S]`: `apply_n_times(func, x, n)`**
Apply `func` to `x` repeatedly `n` times.
```python
apply_n_times(lambda v: v * 2, 3, 4)    # 48
```

**I8 `[L]`: `pipeline(value, *funcs)`**
Pass `value` through each function in order.
```python
pipeline("  Hello World ", str.strip, str.lower, str.split)    # ['hello', 'world']
```

**I9 `[A]`: `describe(**kwargs)`**
Return a string of `key=value` pairs sorted by key, separated by `", "`.
```python
describe(b=2, a=1)      # 'a=1, b=2'
```

**I10 `[A][F]`: `stats(*numbers)`**
Return a tuple `(mean, median, mode)`. For ties in the mode pick the smallest value. Raise `ValueError` if no numbers are given.
```python
stats(1, 2, 2, 3, 4)    # (2.4, 2, 2)
stats(1, 2, 3, 4)       # (2.5, 2.5, 1)
```

---

### Level 3: Challenges

**C1 `[F]`: `contains_subsequence(seq, pattern)`**
Return `True` if the items of `pattern` appear in `seq` **in the same order** (not necessarily next to each other).
```python
contains_subsequence([1, 2, 0, 4, 0, 7, 5], [0, 0, 7])    # True
contains_subsequence([1, 7, 0, 0], [0, 0, 7])             # False
```

**C2 `[F]`: `banner(text, width=None, char="*")`**
Return a three-line framed banner (as one string with `\n`). Default width is `len(text) + 4`; the text is centered.
```python
print(banner("Python", 14))
# **************
# *   Python   *
# **************
```

**C3 `[A][L][S]`: Decorators `timed` and `memoize`**
- `timed(func)` prints how long the function took.
- `memoize(func)` caches results by arguments so repeated calls are instant. Test it with a naive recursive `fib`.

**C4 `[A]`: `validate_password(password, **rules)`**
Return a **list of failed requirements** (empty list means valid). Supported rules: `min_length` (default 8), `digit` (default `True`), `upper` (default `True`), `lower` (default `True`), `banned` (list of forbidden passwords, case-insensitive).
```python
validate_password("abc")          # ['at least 8 characters', 'a digit', 'an uppercase letter']
validate_password("Abcdefg1")     # []
```

**C5 `[F]`: Roman numerals**
Write `int_to_roman(n)` and `roman_to_int(s)` for 1–3999.
```python
int_to_roman(1994)         # 'MCMXCIV'
roman_to_int("MCMXCIV")    # 1994
```

**C6 `[M][F][A]`: Mini project, a contact book**
Using **functions only** (no classes), with a dictionary as the data store:
- `add_contact(book, name, phone, **extra)`: extra keys such as `email` or `city`
- `find_contacts(book, term)`: matches name or phone (case-insensitive)
- `remove_contact(book, name)`: returns `True` if removed
- `save_book(book, path)` / `load_book(path)`: JSON; `load_book` returns `{}` when the file is missing or corrupt

---

### Solutions

> Try each problem first. Every solution below includes tests; running the whole block should print nothing (silence = all `assert`s pass).

**Level 1**

```python
def larger_unless_both_even(a, b):
    """Return the smaller if both are even, else the larger."""
    if a % 2 == 0 and b % 2 == 0:
        return min(a, b)
    return max(a, b)

assert larger_unless_both_even(2, 4) == 2
assert larger_unless_both_even(2, 5) == 5
assert larger_unless_both_even(3, 5) == 5


def same_first_letter(sentence):
    """True if every word starts with the same letter (case-insensitive)."""
    words = sentence.lower().split()
    if not words:
        return False
    return all(word[0] == words[0][0] for word in words)

assert same_first_letter("Peter picked purple peppers")
assert not same_first_letter("big dog")
assert not same_first_letter("")


def hits_target(a, b, target=20):
    """True if a or b equals target, or a + b equals target."""
    return a == target or b == target or a + b == target

assert hits_target(20, 5) and hits_target(12, 8) and not hits_target(3, 4)


def alternate_case(text):
    """Upper-case even positions, lower-case odd positions."""
    return "".join(ch.upper() if i % 2 == 0 else ch.lower()
                   for i, ch in enumerate(text))

assert alternate_case("python") == "PyThOn"


def reverse_words(sentence):
    """Reverse the order of the words."""
    return " ".join(sentence.split()[::-1])

assert reverse_words("I love Python") == "Python love I"


def near(n, targets=(100, 200), tolerance=10):
    """True if n is within `tolerance` of any target."""
    return any(abs(n - t) <= tolerance for t in targets)

assert near(93) and not near(150) and near(209)


def has_adjacent_pair(nums, value):
    """True if `value` appears twice in a row."""
    return any(a == value and b == value for a, b in zip(nums, nums[1:]))

assert has_adjacent_pair([1, 3, 3], 3)
assert not has_adjacent_pair([3, 1, 3], 3)
assert has_adjacent_pair([3, 3, 3], 3)


def repeat_letters(text, times=2):
    """Repeat every character `times` times."""
    return "".join(ch * times for ch in text)

assert repeat_letters("Hello") == "HHeelllloo"
assert repeat_letters("ab", 3) == "aaabbb"


def hand_value(cards):
    """Sum of cards; one 11 may count as 1 to avoid going over 21."""
    total = sum(cards)
    if total <= 21:
        return total
    if 11 in cards and total - 10 <= 21:
        return total - 10
    return "BUST"

assert hand_value([5, 6, 7]) == 18
assert hand_value([9, 9, 11]) == 19
assert hand_value([10, 10, 5]) == "BUST"
assert hand_value([11, 11, 5]) == 17


def is_prime(n):
    """True if n is a prime number."""
    if n < 2:
        return False
    for d in range(2, int(n ** 0.5) + 1):
        if n % d == 0:
            return False
    return True


def count_primes_upto(n):
    """Count the primes <= n."""
    return sum(1 for k in range(2, n + 1) if is_prime(k))

assert count_primes_upto(10) == 4
assert count_primes_upto(30) == 10
assert count_primes_upto(100) == 25
```

**Level 2**

```python
def running_totals(nums):
    """Return the cumulative sums of nums."""
    totals, current = [], 0
    for n in nums:
        current += n
        totals.append(current)
    return totals

assert running_totals([1, 2, 3, 4]) == [1, 3, 6, 10]
assert running_totals([]) == []


def flatten_once(nested):
    """Flatten one level of nesting."""
    return [item for sub in nested for item in sub]

assert flatten_once([[1, 2], [3], [], [4, 5]]) == [1, 2, 3, 4, 5]


def word_stats(text):
    """Return count, longest word and average word length."""
    words = [w.strip(".,!?;:\"'()") for w in text.split()]
    words = [w for w in words if w]
    if not words:
        return {"count": 0, "longest": None, "average_length": 0.0}
    return {
        "count": len(words),
        "longest": max(words, key=len),
        "average_length": round(sum(map(len, words)) / len(words), 2),
    }

assert word_stats("The quick brown fox.") == {
    "count": 4, "longest": "quick", "average_length": 4.0}
assert word_stats("") == {"count": 0, "longest": None, "average_length": 0.0}


def is_anagram(a, b):
    """True if a and b contain the same letters (ignoring case and spaces)."""
    clean = lambda s: sorted(s.replace(" ", "").lower())
    return clean(a) == clean(b)

assert is_anagram("Dormitory", "Dirty room")
assert not is_anagram("hello", "world")


def compose(f, g):
    """Return h where h(x) == f(g(x))."""
    return lambda x: f(g(x))

assert compose(str.upper, str.strip)("  hi ") == "HI"


def make_counter(start=0, step=1):
    """Return a function that counts upward by `step` on each call."""
    count = start

    def counter():
        nonlocal count
        count += step
        return count

    return counter

c = make_counter()
assert (c(), c()) == (1, 2)
d = make_counter(10, 5)
assert (d(), d()) == (15, 20)
assert c() == 3          # independent state


def apply_n_times(func, x, n):
    """Apply func to x, n times."""
    for _ in range(n):
        x = func(x)
    return x

assert apply_n_times(lambda v: v * 2, 3, 4) == 48
assert apply_n_times(lambda v: v + 1, 0, 0) == 0


def pipeline(value, *funcs):
    """Pass value through each function in order."""
    for func in funcs:
        value = func(value)
    return value

assert pipeline("  Hello World ", str.strip, str.lower, str.split) == ["hello", "world"]


def describe(**kwargs):
    """Return 'key=value' pairs sorted by key."""
    return ", ".join(f"{k}={v}" for k, v in sorted(kwargs.items()))

assert describe(b=2, a=1) == "a=1, b=2"
assert describe() == ""


def stats(*numbers):
    """Return (mean, median, mode); smallest value wins mode ties."""
    if not numbers:
        raise ValueError("at least one number required")
    ordered = sorted(numbers)
    n = len(ordered)
    mean = sum(ordered) / n
    mid = n // 2
    median = ordered[mid] if n % 2 else (ordered[mid - 1] + ordered[mid]) / 2
    counts = {}
    for x in ordered:
        counts[x] = counts.get(x, 0) + 1
    mode = max(sorted(counts), key=lambda k: counts[k])
    return mean, median, mode

assert stats(1, 2, 2, 3, 4) == (2.4, 2, 2)
assert stats(1, 2, 3, 4) == (2.5, 2.5, 1)
```

**Level 3**

```python
# C1
def contains_subsequence(seq, pattern):
    """True if pattern's items appear in seq in order (gaps allowed)."""
    position = 0
    for item in seq:
        if position < len(pattern) and item == pattern[position]:
            position += 1
    return position == len(pattern)

assert contains_subsequence([1, 2, 0, 4, 0, 7, 5], [0, 0, 7])
assert not contains_subsequence([1, 7, 0, 0], [0, 0, 7])
assert contains_subsequence([1, 2], [])

# Bonus: the iterator trick (each `in` consumes the iterator up to the match)
def contains_subsequence_iter(seq, pattern):
    it = iter(seq)
    return all(item in it for item in pattern)

assert contains_subsequence_iter([1, 2, 0, 4, 0, 7, 5], [0, 0, 7])
```

```python
# C2
def banner(text, width=None, char="*"):
    """Return a three-line framed banner with centered text."""
    width = width or len(text) + 4
    inner = width - 4
    return "\n".join([
        char * width,
        f"{char} {text:^{inner}} {char}",
        char * width,
    ])

assert banner("Hi") == "******\n* Hi *\n******"
assert banner("Python", 14).splitlines()[1] == "*   Python   *"
```

```python
# C3
import time
from functools import wraps

def timed(func):
    """Print how long each call of func takes."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.6f}s")
        return result
    return wrapper


def memoize(func):
    """Cache results by positional arguments."""
    cache = {}

    @wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    return wrapper


@memoize
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

assert fib(80) == 23416728348467685     # instant, thanks to the cache


@timed
def slow_sum(n):
    return sum(range(n))

slow_sum(1_000_000)      # prints e.g. "slow_sum took 0.012345s"
```

```python
# C4
def validate_password(password, **rules):
    """Return the list of requirements the password fails."""
    min_length = rules.get("min_length", 8)
    problems = []
    if len(password) < min_length:
        problems.append(f"at least {min_length} characters")
    if rules.get("digit", True) and not any(c.isdigit() for c in password):
        problems.append("a digit")
    if rules.get("upper", True) and not any(c.isupper() for c in password):
        problems.append("an uppercase letter")
    if rules.get("lower", True) and not any(c.islower() for c in password):
        problems.append("a lowercase letter")
    if password.lower() in {b.lower() for b in rules.get("banned", [])}:
        problems.append("a password that is not banned")
    return problems

assert validate_password("abc") == [
    "at least 8 characters", "a digit", "an uppercase letter"]
assert validate_password("Abcdefg1") == []
assert validate_password("Abcdefg1", banned=["abcdefg1"]) == ["a password that is not banned"]
assert validate_password("abc", min_length=3, digit=False, upper=False) == []
```

```python
# C5
ROMAN = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
         (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
         (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]

def int_to_roman(n):
    """Convert 1..3999 to a Roman numeral."""
    if not 1 <= n <= 3999:
        raise ValueError("n must be between 1 and 3999")
    result = ""
    for value, symbol in ROMAN:
        count, n = divmod(n, value)
        result += symbol * count
    return result


def roman_to_int(s):
    """Convert a Roman numeral to an integer."""
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    for current, following in zip(s, s[1:] + " "):
        value = values[current]
        if following in values and values[following] > value:
            total -= value
        else:
            total += value
    return total

assert int_to_roman(1994) == "MCMXCIV"
assert roman_to_int("MCMXCIV") == 1994
assert all(roman_to_int(int_to_roman(n)) == n for n in range(1, 4000))
```

```python
# C6
import json
from pathlib import Path

def add_contact(book, name, phone, **extra):
    """Add (or replace) a contact; extra fields are stored too."""
    book[name.lower()] = {"name": name, "phone": phone, **extra}
    return book


def find_contacts(book, term):
    """Return contacts whose name or phone contains `term`."""
    term = term.lower()
    return [c for key, c in book.items() if term in key or term in c["phone"]]


def remove_contact(book, name):
    """Remove a contact; return True if it existed."""
    return book.pop(name.lower(), None) is not None


def save_book(book, path="contacts.json"):
    """Save the book as UTF-8 JSON."""
    Path(path).write_text(json.dumps(book, indent=2, ensure_ascii=False),
                          encoding="utf-8")


def load_book(path="contacts.json"):
    """Load the book; return {} if missing or corrupt."""
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


book = {}
add_contact(book, "Sara", "0935-444-5566", email="sara@example.com")
add_contact(book, "Ali", "0912-111-2233", city="Tehran")
assert [c["name"] for c in find_contacts(book, "sa")] == ["Sara"]
assert [c["name"] for c in find_contacts(book, "0912")] == ["Ali"]
assert remove_contact(book, "ALI") is True
assert remove_contact(book, "Nobody") is False

save_book(book, "test_contacts.json")
assert load_book("test_contacts.json") == book
assert load_book("does_not_exist.json") == {}
```

**Scoring guide for Section 6** (26 problems in total; grade yourself like this):

| Result | Meaning |
|---|---|
| All Level 1 + at least 7 of Level 2 + 2 of Level 3 | Excellent: you are ready for classes and OOP |
| All Level 1 + 5 of Level 2 | Good: re-do the ones you missed after a few days |
| Fewer than 8 Level 1 | Re-read Chapters 1–2 and retry without looking at solutions |

---

## 7. Appendix

### 7.1 Methods and functions cheat sheet

```python
# --- Methods ---
obj.method(args)              # call a method
dir(obj); help(obj.method)    # explore
text.strip().lower().split()  # chain (each step returns a new str)
nums.sort()                   # in place -> returns None
sorted(nums)                  # new list

# --- Functions ---
def name(a, b=0, *args, key=None, **kwargs):
    """Docstring."""
    return a + b

name(1, 2, 3, key=len, x=5)
name(*[1, 2], **{"key": len})

# --- Lambda, map, filter, reduce ---
square = lambda x: x * x
list(map(square, nums))
list(filter(lambda n: n % 2, nums))
from functools import reduce
reduce(lambda a, b: a * b, nums)
sorted(items, key=lambda it: (it[1], it[0]))

# --- Scope (LEGB) ---
# Local -> Enclosing -> Global -> Built-in
global x           # rebind a module-level name (rare)
nonlocal x         # rebind a name in the enclosing function (closures)
```

### 7.2 Parameter types at a glance

| Form | Example | Meaning |
|---|---|---|
| Positional | `def f(a, b)` | Required, by position or name |
| Default | `def f(a, b=0)` | Optional |
| `*args` | `def f(*args)` | Extra positional → tuple |
| Keyword-only | `def f(*, key)` | Must be passed by name |
| `**kwargs` | `def f(**kwargs)` | Extra keyword args → dict |
| Positional-only | `def f(a, /)` | Cannot be passed by name |

### 7.3 Common mistakes checklist

| Mistake | Fix |
|---|---|
| `x = my_list.sort()` gives `None` | Call `my_list.sort()` alone or use `sorted()` |
| Chaining a method that returns `None` | Split into separate statements |
| `print()` instead of `return` inside a function | Return the value; print outside |
| Forgetting to **call** a function (`func` vs `func()`) | Add parentheses |
| Mutable default (`def f(x=[])`) | Use `None` and create the list inside |
| `count += 1` inside a function on a global | Pass in / return, or use `global` (sparingly) |
| Reassigning an outer variable in a nested function | Use `nonlocal` |
| Naming variables `list`, `sum`, `max`, `str`, `id` | Use descriptive names |
| Lambda in a loop capturing the loop variable | `lambda i=i: ...` |
| Using `lambda` for long logic | Write a `def` with a docstring |
| `*args` order wrong (`def f(**kw, *a)`) | Positional → defaults → `*args` → keyword-only → `**kwargs` |
| Unlimited recursion | Add/verify a base case; use a loop for deep problems |
| Modifying an argument unexpectedly (side effect) | Copy it first, or return a new object |

### 7.4 Suggested learning path

1. Read each chapter, running every example and finishing the **Try It** exercises.
2. Do the Level 1 homework right after Chapters 1–2, Level 2 after Chapter 5, Level 3 last.
3. Re-implement the **Guessing Game** from Module 2 using small functions (`get_guess`, `feedback`, `play`), with tests for each.
4. Next module: **Object-Oriented Programming**. The `BankAccount` class in Section 1.7 and closures in Section 4.6 are your preview.

---

*End of document.*
