CC=gcc
CFLAGS=-std=gnu99 -Wall -g
LDFLAGS=-lm

all: trafsim

trafsim: trafsim.o mobj_mem.o smlog.o mobj_out.o

clean:
	rm -f *.o trafsim

.PHONY: clean

