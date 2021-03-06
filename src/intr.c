/* -*- Mode: C; c-file-style: "stroustrup"; indent-tabs-mode:nil; -*- */
/*
Copyright (c) 2004-2013 GoPivotal, Inc. All Rights Reserved.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,  WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations
under the License.
*/

#include <string.h>
#include <stdio.h>
#include "portability.h"
#include "intr.h"

volatile int intr = 0;
int intr_sig = 0;

#ifdef WIN32

  void intr_handler( int sig ) {
	  char c;
	  fprintf( stdout, "\nShutdown? [y/n]" ); fflush( stdout );
	  c = getchar();
	  if ( c == 'y' || c == 'Y' ) {
		  fprintf( stdout, "  Started to shutdown...\n" );
		  intr++;
	  } else {
		  fprintf( stdout, "  Continuing to serve...\n" );
	  }
	  return;
  }

  sighandler_t intr_func = intr_handler;
  /* must be thread local! */
  #ifndef LIBRARY
  HANDLE __declspec(thread) intr_handle = 0;
  #endif

  int intr_hook( int sig ) { intr_sig = sig; return 1; }
  int intr_unhook( void ) { return 1; }

#else

  struct sigaction intr_old;
  void intr_handler( int sig ) {
	  struct sigaction prev;
  	  char c;
	  fprintf( stdout, "\nShutdown? [y/n]" ); fflush( stdout );
	  c = getchar();
	  if ( c == 'y' || c == 'Y' ) {
		  sigaction( sig, &intr_old, &prev );
		  fprintf( stdout, "  Started to shutdown...\n" );
		  intr++;
	  } else {
		  fprintf( stdout, "  Continuing to serve...\n" );
	  }
	  return;
  }

  int intr_hook( int sig ) {
      int res;
      struct sigaction actions;
      memset( &actions, '\0', sizeof( actions ) );
      sigemptyset( &actions.sa_mask );
      actions.sa_flags = 0;
      actions.sa_handler = intr_handler;
      res = sigaction( sig ? sig : SIGUSR1, &actions, &intr_old );
      if ( res < 0 ) {
          return 0;
      }
      intr_sig = sig ? sig : SIGUSR1;
      return 1;
  }

  int intr_unhook( void ) {
      int res;
      res = sigaction( intr_sig, &intr_old, NULL );
      if ( res < 0 ) { return 0; }
      return 1;
  }

#endif
