There has been something that has been festering in the back of my head for some time now. It's the desire to build a CPU from basic logic blocks. Either 7000 
series logic chips, pure transistors, or relays; it doesn't matter what it is, I only really care about doing it. Unfortunately I have absolutely no background in 
electrical or computer engineering and I have no money so I can't afford to start buying supplies to learn. In the mean time, while I attempt to amass money, I 
can do something that is more practical for a programmer like me: write a simulator for the ISA of a processor. This blog post details the implementation of a 
simple CPU with 2 instructions. More instructions can be added but for this post I want to stick to the basics. The code used to create this tutorial can also be 
thought of as a virtual machine for a compiled programming language in the vain of the JVM (except much simpler).

# The Point

This project isn't about building the next CPU that will power all computers. It's about designing something and implementing it simply. Constraining something to 
the barest feature set is a very valuable skill-set that small projects like this let you practice. We're not going to be battling ARM and Intel at the end of 
this but we'll learn something along the way.

# What is a Processor

A Processor is a device that takes data, performs an operation on in, and ideally outputs that data to something else. Processors come in many forms and 
functions. Some of the most common processors are Digital Signal Processing chips, Analog Signal Processing chips, Digital Logic Processing Chips. These chips are 
created to implement a single functionality very efficently. They are designed to be an adder, or a muxer, or something and will only ever be what they were built 
for.

![<Digital Signal Processor Chip Picture>](https://upload.wikimedia.org/wikipedia/commons/a/a9/Dsp_chip.jpg "An example of a DSP chip")

This tutorial is focused on building a different kind of processor: a general purpose programable processor. These types of processors can be told what type of 
operation to perform by a programmer and they will perform these operations. This kind of processor is found within your computer and within many houshold 
electronics in the form of a microcontroler.

Most processors that are useful are [Turing Complete](https://en.wikipedia.org/wiki/Turing_completeness "Better expliation than I can give". This is a more 
complicated (and important) topic than I'm ready to cover in this post so I'd suggest you find a better explination from someone who won't mess it up like I 
would. An interested reader could take the code described here and fully implement a turing complete processor (an interested reader could also do this by 
implementing a single instruction). For the sake of brevity I will only implement a very limited feature set in this post.

# Our Processor

When our CPU starts it will expect a program to be loaded in it's memory. It will initialize all of it's registers to 0, including the PC. The program counter 
(PC) register tells the CPU which memory address to take the next instruction from. Our CPU will begin the Fetch, Decode, and Execute cycles where it will pull 
the next instruction from memory into the processor's internals, find out what the instruction wants, and then execute the instruction.

## Features

| Byte Width     | 8 bits                                        |
| Memory Space   | 256 bytes                                     |
| Register Names | r0..r255 and PC                               |
| Opcode         | 1 byte and variable number of 1 byte operands |

## Instructions 

| Name           | OpCode    | Operands                 | Description                  |
| -------------- | --------- | ------------------------ | ---------------------------- |
| HLT            | 0000 0000 | N/A                      | Stops the CPU execution loop |
| ADD            | 0000 0001 | Left, Right, Register    | Register = Left + Right      |


It may be strange to some that I specify "8-bit byte" here because it is often overlooked, and strongly ignored in my college, that byte-width is variable 
depending on platform. A byte is defined as the minimum width of data that can be pulled from memory at once. I have chosen an 8-bit wide byte to make 
simulation, program loading, and program generation easier on my x86_64 Intel CPU. When designing your own ISA and system if you so choose you can declare that 
you will use 1 bit-wide bytes but this would, for most applications, be very silly.

This CPU makes no sense for a practical use case but is perfectly fine as an example. Having as many registers as you have memory words would be strange and if 
you wanted to support multitasking in your CPU than having that many registers would make swaping processes very slow as you'd need to store and load 256 
registers.

# Program Generation

When compiling programs by hand it is often advantageous to either see hex values or binary values of the things you are writing. Unfortunatly, as it turns out, 
there are few programs out that support turning binary from textual ones and zeros into binary files. Because of this I have written my own binary "transpiler". 
It reads from stdin writes to a file you specify. It's very hacked together C so it's likely buggy but will work well enough to turn an example program into 
something runnable by our CPU. This program supports comments and whitespace for seperating groupings of characters. Each byte is written on a new line.


```c
#include <stdlib.h>
#include <stdio.h>
#include <limits.h>
#include <stdbool.h>
#include <ctype.h>
#include <memory.h>

/**
 * Check to see if a line only contains blank characters.
 * @param line - Line read from stream
 * @param len - Number of bytes in the line
 * @return - True if there is only whitespace in this line
 */
bool is_whitespace(const char *line, ssize_t len) {
    for (int i = 0; i < len; i++) {
        if (!isspace(line[i]))
            return false;
    }
    return true;
}

/**
 * Checks to see if the first non-blank character in this string is a "#" making it a comment line.
 * @param line
 * @param len
 * @return
 */
bool is_comment(const char *line, ssize_t len) {
    for (size_t i = 0; i < len; i++) {
        if (isspace(line[i]))
            continue;
        return line[i] == '#';
    }
    return false;
}

/**
 * Count the number of binary-like digits in a single line.
 * @param line
 * @return
 */
size_t number_of_ones_and_zeros_in(const char *line) {
    size_t total = 0;

    while (*line) {
        const char c = *(line++);

        if (c != '1' && c != '0')
            continue;

        total += 1;
    }
    return total;
}

/**
 * Turn a string of ones and zeros into an unsigned char.
 * @param line
 * @return
 */
unsigned char binary_decode(const char *line) {
    unsigned char byte = 0;

    for (size_t i = 0; i < CHAR_BIT; i++)
        byte = (byte << 1) + (line[i] == '1');

    return byte;
}

int main(int argc, char **argv) {

    char *line = NULL;
    size_t lin_len;
    ssize_t len = 0;
    char binary_string_buffer[CHAR_BIT + 1];

    FILE *out = fopen(argc < 2 ? "program.bin" : argv[1], "wb");

    while ((len = getline(&line, &lin_len, stdin)) > 0) {

        // Clear the buffer
        memset(binary_string_buffer, 0, CHAR_BIT + 1);

        // Check to see if this is a binary character
        if (is_whitespace(line, len) || is_comment(line, len))
            continue;

        if (number_of_ones_and_zeros_in(line) != CHAR_BIT) {
            fprintf(stderr, "ERROR: Line unrecognized ``%s''\n", line);
            exit(1);
        }

        size_t buffer_location = 0;
        for (size_t i = 0; i < len; i++) {
            if (line[i] != '0' && line[i] != '1')
                continue;
            binary_string_buffer[buffer_location++] = line[i];
        }

        const unsigned char byte = binary_decode(binary_string_buffer);
        fwrite(&byte, sizeof(char), 1, out);
    }
    fclose(out);
}
```

With this program we can transform programs written like this into something executable by our processor:

```
# add 1 1 0
0000 0001
	0000 0001
	0000 0001
	0000 0000

# hlt
0000 0000
```

The hashes are comments and are ignored. The indented lines are just to make the arguments of the opcode more readable. This program makes use of the only two 
opcodes we've specified. It adds a binary literal '0000 0001' to a binary literal '0000 0001' and stores the result into r0. The next instruction is hlt and that 
will tell the cpu that it's done running. Now that we have a program that is valid for our designed CPU we can start writing a simulator. In a future post I may 
write an assembler for this "architecture".

# Writing the Simulator

To make it easy to add, remove, and change opcodes all of that information will be generated automatically. Our main loop for our CPU will be simple. We will have access to two data structures.

```c

#define MEM_SPACE 256

typedef struct {
	char pc; // Max size of memory
	char registers[256];
} cpu;

typedef struct {
	void (*opcode)(cpu *c, char args[]);
	char num_args;
} instruction;

char memory[MEM_SPACE];
instruction *opcodes[] = { /* ... operations ... */ };
int max_opcode = sizeof(opcodes) / sizeof(instruction*);
```

The 'instruction' type will be used to export definitions of instructions implemented in other files. It will make it easy to load them without needing to know 
where they come from. The 'instruction' type contains a pointer to a function accepts a pointer to our current CPU state and a char[] that contains the arguments 
needed to run the operation. The 'cpu' type is used to track the CPU's registers and the number of operands this operation requires. Our main loop is as follows:


```c
// CPU is declared
cpu c;

int num_cycles = 0;
while (1)
{
	unsigned char opcode = (unsigned char) memory[c.pc];
	if (opcode >= max_opcode)
	{
		printf("ERR: Unknown exception\n");
		break;
	}

	// Handle HLT
	if (opcode == 0)
	{
		printf("SYS: Finished program! (%d cycles)\n", num_cycles);
		break;
	}

	instruction *i = opcodes[opcode];	
	if ((i->num_args + c.pc + 1) >= MEM_SPACE)
	{
		printf("ERR: Malformed program. Not enough data for instruction\n");
		break;
	}

	// Run opcode
	i->opcode(&c, memory + 1);

	c.pc += 1 + i->num_args;
	
}

```

As you can see our CPU loop is very simple. This is not the fastest way to create an interpreter but it is incredebly easy to understand what is going on. It's 
also important to note that one could completely hide the implementation of each opcode from the main file. All you need to do to add an opcode is write 'extern 
instruction opcode_name' and add a reference to it into the 'opcodes' array. The following is the definition of the add instruction.


```c

// Define function
void add(cpu *c, char args[])
{
	char left  = args[0]; // Pull out operands
	char right = args[1];
	char reg   = args[2];

	c->registers[reg] = (left + right); // Set the register
}
instruction add_instruction = {.opcode=&add, .num_args=3}; // define the instruction

```

In your file that holds all of the instruction pointers you can do the following...


```c
extern instruction add_instruction;

instruction *opcodes[] = {
	NULL,            // HLT Instruction's opcode
	&add_instruction /* ... operations ... */
};
```

And there you go! You have a programmable processor! It's not turing complete but it's close since we can add into the PC. If you had an instruction that could 
add one register into another you could implement conditional loops.
