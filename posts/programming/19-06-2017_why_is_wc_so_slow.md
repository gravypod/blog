A while ago I started working in research. Part of my job when I started was to take huge CSV files with data, find a way to plot the data, and show those plots to people who are much smarter then I am. I was also meant to be sort of a quarter master for the data. Sometimes in the course of duty it was common for someone to ask "How many data points are in this plot?" or "How many samples do you have to look at in total?" and to answer that question I normally open my terminal, `cd` into my data folder, and run `wc` on my file(s). Now being an impatient computer programmer something felt amiss. `wc` was taking too long for just counting lines, "words", and characters. The obvious solution was to obsessively rewrite and optimize a custom version of the subset of features provided by `wc`. This was in some ways prompted by the post [How is GNU yes so fast?](https://www.reddit.com/r/unix/comments/6gxduc/how_is_gnu_yes_so_fast/?st=j3v3iw3c&sh=5651ea3c)

How slow was `wc`?
------------------

On my Thinkpad X220, with a PNY SSD and Linux's in-memory file cache, running `wc` on my ~2GB data file took about 24 seconds. It was slower on my work machine because that doesn't have an SSD.

How fast should `wc` be?
------------------------

We can run some tests and then do some napkin math to find out what the bare minimum processing time should be for this kind of work load. I think a fair test is to read from disk into `/dev/null` and then re-read the data into `/dev/null` after it's cached by Linux.

From Disk:

```bash
$ dd if=file.dat of=/dev/null
3975999+1 records in
3975999+1 records out
2035711526 bytes (2.0 GB, 1.9 GiB) copied, 6.83698 s, 298 MB/s
```

From Memory Cache:

```bash
cat file.dat | pv > /dev/null
 1.9GiB 0:00:00 [2.52GiB/s] [<=>                                               ]
```

We expect to see:

* Channel from disk to CPU to buffer: ~298MB/s 
* Channel from memory to CPU: 2705.829MB/s
* Data file size: ~2000MB 
* Estimated Read (Disk) to buffer: 6.7 seconds
* Estimated Read (Cache) to buffer: 0.7 seconds

That means `wc` is spending ~23.3 seconds to parse command line args, parsing file contents, and printing results. Ideally on a "modern" super-scalar CPU you'd expect to be able to process all of your input without being bottle-necked things like processing speed. I'd suspect things like memory CAS latency and disk read times to be the culprit. From our tests we can see that's not the case. My system's disk and memory have no problem providing data to my CPU at fast speeds. That means something is funky with the code processing it.

Where is `wc` spending it's time?
---------------------------------

Lets run `wc` on my data file and track it's operations with `perf`.

    $ perf stat wc file.dat
      12777446   25554891 2035711526 file.dat

     Performance counter stats for 'wc file.dat':

          25049.125083      task-clock:u (msec)       #    1.000 CPUs utilized          
                     0      context-switches:u        #    0.000 K/sec                  
                     0      cpu-migrations:u          #    0.000 K/sec                  
                    94      page-faults:u             #    0.004 K/sec                  
        80,911,666,679      cycles:u                  #    3.230 GHz                    
        19,338,599,460      stalled-cycles-frontend:u #   23.90% frontend cycles idle   
         3,146,489,863      stalled-cycles-backend:u  #    3.89% backend cycles idle    
       184,760,792,059      instructions:u            #    2.28  insn per cycle         
                                                      #    0.10  stalled cycles per insn
        47,003,256,583      branches:u                # 1876.443 M/sec                  
            25,986,948      branch-misses:u           #    0.06% of all branches        

          25.050096062 seconds time elapsed

A few things jump out at me when looking at these results. First of all we are only actually hitting an average of 2.28 instructions per cycle this means we are only actually making use of half of the pipeline. The next most interesting thing that jumps out at me is the instruction count. At 184,760,792,059 instructions for a 2035711526 character file we are running ~91 instructions per character!! Looking at branches we can also see that at 47,003,256,583 branches we are doing ~23 branches per character!! It is also interesting to note that my had to clock to 3.230 GHz which is nearly the max turbo frequency (3.3 GHz). This is definitely not right.

Can we do better?
-----------------

Yes.

I've written an implementation that is simple to follow and implements all but three features of `wc`. You can't select what to count, you cant give it a file that contains a list of files, and it doesn't format the output nicely. This is a "simple" example of a word counting program. The program is 135 lines most of which is spaces and comments. It's probably not bug free and it's not production ready. I just wanted to see if it was possible. Below you can find the source.

```C
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// This is a "chunk" of characters that we can pull out and handle
// at one time. Since arrays in C are just collections of bytes we
// can iterate through a char array and pretend it was an int array.
// Using this union you can still get at the individual characters.
typedef union {
    int value;
    char letters[4];
} chunk_t;

// Total lines, words, and chars in all of the files passed.
static int total_line_count = 0, total_word_count = 0, total_char_count = 0;


void help(const char *cmd)
{
    printf("Usage: %s <--help|file...>\n", cmd);
    exit(1);
}

static inline void count_word(const char next, int * const word_count)
{
    static bool is_in_word = false;
    const bool is_next_space = isspace(next);
    if (is_in_word && is_next_space)
    {
        *word_count += 1;
        is_in_word = false;
    }
    else if (!is_in_word && !is_next_space)
    {
        is_in_word = true;
    }
}

static inline void count_newl(const char next, int * const line_count)
{
    *line_count += next == '\n';
}


static inline void count_chunk(const chunk_t * const chunk, int * const line_count, int * const word_count)
{
    // Count all new lines.
    count_newl(chunk->letters[0], line_count);
    count_newl(chunk->letters[1], line_count);
    count_newl(chunk->letters[2], line_count);
    count_newl(chunk->letters[3], line_count);

    // For each chunk, count the letters.
    count_word(chunk->letters[0], word_count);
    count_word(chunk->letters[1], word_count);
    count_word(chunk->letters[2], word_count);
    count_word(chunk->letters[3], word_count);
}


static inline void print_stats(const char* file_name)
{

#define BUFFER_SIZE (1024 * 16)

    // Make a character buffer for reading the chunks of the file into.
    // Most of the time pages are 4k or 8k aligned so the buffer should
    // be one of those sizes. This will make sure you don't ask for more
    // data then the kernel is likely to have buffered for you.
    static char cbuffer[BUFFER_SIZE];

    // Make a new way of looking at the character buffer. This lets you
    // loop throuh and look at 4 characters at a time. This cuts down on
    // the number of loops you are running and will let you eventually
    // pipeline instructions for counting.
    static chunk_t * const gbuffer = (chunk_t*) cbuffer;

    // Keep track of all of the values we want to print.
    int line_count = 0, word_count = 0, char_count = 0;

    // File handling. We only want to read.
    FILE* file = fopen(file_name, "r");

    if (!file)
    {
        printf("No such file %s\n", file_name);
        return;
    }

    // Read until we don't get any more data.
    size_t read_size;
    while ((read_size = fread(cbuffer, sizeof(char), BUFFER_SIZE, file)))
    {
        // Count characters
        char_count += read_size;

        // Handle bulk chunks
        for (int i = 0; i < (read_size / sizeof(chunk_t)); i++)
            count_chunk(&gbuffer[i], &line_count, &word_count);

        // Handle where N % 4 != 0. This is left over characters at the
        // end of the buffer that exist if the file length wasn't divisable
        // by sizeof(int)
        for (int i = (read_size - (read_size % 4)); i < read_size; i++)
        {
            count_newl(cbuffer[i], &line_count);
            count_word(cbuffer[i], &word_count);
        }
    }

    fclose(file);

    printf("%d %d %d %s\n", line_count, word_count, char_count, file_name);

    // Add to the total line count.
    total_line_count += line_count;
    total_word_count += word_count;
    total_char_count += char_count;
}


int main(const int argc, const char *argv[])
{
    if (argc == 1 || strcmp(argv[1], "--help") == 0)
        help(argv[0]);

    for (int i = 1; i < argc; i++)
        print_stats(argv[i]);

    // If more then one file print totals.
    if (argc - 1 > 1)
        printf("%d %d %d total\n", total_line_count, total_word_count, total_char_count);
}
```

As you can see the program is extremely simple. The only "complicated" things I have done are...

1.  Reading from the file into a buffer instead of just using `fgetc`
2.  Looping over the buffer as an int buffer to coax the CPU into taking
    advantage of it's pipeline
3.  Liberal usage of const, static, and inline

Are we any faster?
------------------

You guessed it! We can run a few tests. When testing the current version with "-O0" we actually come up slower by ~12% of run time so I've omitted that test. I've only rarely had to use "-O0" so omitting it is not a huge sin in my opinion.

```bash
$ make
gcc -Wall -Isrc/ -pedantic-errors -O1  -c src/main.c -o bin/obj/src/main.o
gcc bin/obj/src/main.o  -o bin/line_count
$ perf stat ./bin/line_count file.dat
12777446 25554891 2035711526 file.dat

 Performance counter stats for './bin/line_count file.dat':

       5216.490383      task-clock:u (msec)       #    1.000 CPUs utilized          
                 0      context-switches:u        #    0.000 K/sec                  
                 0      cpu-migrations:u          #    0.000 K/sec                  
                47      page-faults:u             #    0.009 K/sec                  
    15,902,053,747      cycles:u                  #    3.048 GHz                    
     6,140,533,032      stalled-cycles-frontend:u #   38.61% frontend cycles idle   
     1,046,042,916      stalled-cycles-backend:u  #    6.58% backend cycles idle    
    39,070,649,827      instructions:u            #    2.46  insn per cycle         
                                                  #    0.16  stalled cycles per insn
     2,550,514,277      branches:u                #  488.933 M/sec                  
        13,405,434      branch-misses:u           #    0.53% of all branches        

       5.217152251 seconds time elapsed
```

I'm fairly sure that the `wc` binary on my machine was compiled with -O2 so lets try that.

```bash
$ make
gcc -Wall -Isrc/ -pedantic-errors -O2  -c src/main.c -o bin/obj/src/main.o
gcc bin/obj/src/main.o  -o bin/line_count
$ perf stat ./bin/line_count file.dat
12777446 25554891 2035711526 file.dat

 Performance counter stats for './bin/line_count file.dat':

       2137.897867      task-clock:u (msec)       #    1.000 CPUs utilized          
                 0      context-switches:u        #    0.000 K/sec                  
                 0      cpu-migrations:u          #    0.000 K/sec                  
                48      page-faults:u             #    0.022 K/sec                  
     5,997,760,469      cycles:u                  #    2.805 GHz                    
       993,110,621      stalled-cycles-frontend:u #   16.56% frontend cycles idle   
       989,403,431      stalled-cycles-backend:u  #   16.50% backend cycles idle    
    18,447,377,489      instructions:u            #    3.08  insn per cycle         
                                                  #    0.05  stalled cycles per insn
     3,059,448,487      branches:u                # 1431.055 M/sec                  
        12,957,221      branch-misses:u           #    0.42% of all branches        

       2.138311651 seconds time elapsed
```

We've beaten my system's `wc` on a level playing field. Now lets see what some more tuning parameters will yield us (if anything).

```bash
$ make
gcc -Wall -Isrc/ -pedantic-errors -Ofast -ftree-vectorize -msse -msse2 -ffast-math -c src/main.c -o bin/obj/src/main.o
gcc bin/obj/src/main.o  -o bin/line_count
$ perf stat ./bin/line_count file.dat
12777446 25554891 2035711526 file.dat

 Performance counter stats for './bin/line_count file.dat':

       2135.202473      task-clock:u (msec)       #    1.000 CPUs utilized          
                 0      context-switches:u        #    0.000 K/sec                  
                 0      cpu-migrations:u          #    0.000 K/sec                  
                47      page-faults:u             #    0.022 K/sec                  
     5,983,418,074      cycles:u                  #    2.802 GHz                    
       980,037,731      stalled-cycles-frontend:u #   16.38% frontend cycles idle   
       982,123,753      stalled-cycles-backend:u  #   16.41% backend cycles idle    
    18,395,770,695      instructions:u            #    3.07  insn per cycle         
                                                  #    0.05  stalled cycles per insn
     3,065,584,723      branches:u                # 1435.735 M/sec                  
        11,818,548      branch-misses:u           #    0.39% of all branches        

       2.135874517 seconds time elapsed
```

We miss a few less branches. I don't think any of the vectorization flags were used. This is just my standard Makefile's compile flags. To sum...

1.  We are only running ~9 instructions per character (still bad)
2.  We are predicting more of our branches
3.  We are saturating the pipeline better (3.07 instructions per cylce)
4.  We didn't turbo clock my CPU
5.  We wan less instructions in total

Some may say "Well if you're using -Ofast you're going to end up with a huge binary. You're also using that huge 16k buffer!" Lets check that out!

```bash
$ ls -alh line_count $(which wc)
-rwxr-xr-x 1 me       me       8.6K Jun 19 13:16 line_count
-rwxr-xr-x 1 root     root      43K Mar 12 10:09 wc
```

Modern compilers really are a miracle, aren't they?
