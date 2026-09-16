#include <errno.h>
#include <libgen.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static volatile sig_atomic_t child_pid = -1;

static void forward_signal(int signal_number) {
  if (child_pid > 0) {
    kill((pid_t)child_pid, signal_number);
  }
}

int main(void) {
  char executable_path[PATH_MAX];
  uint32_t executable_path_size = sizeof(executable_path);
  if (_NSGetExecutablePath(executable_path, &executable_path_size) != 0) {
    fputs("launcher: executable path is too long\n", stderr);
    return 1;
  }

  char directory_buffer[PATH_MAX];
  if (strlcpy(directory_buffer, executable_path, sizeof(directory_buffer)) >=
      sizeof(directory_buffer)) {
    fputs("launcher: executable directory is too long\n", stderr);
    return 1;
  }
  const char *executable_directory = dirname(directory_buffer);

  char main_script[PATH_MAX];
  if (snprintf(main_script, sizeof(main_script), "%s/../Resources/main.js",
               executable_directory) >= (int)sizeof(main_script)) {
    fputs("launcher: resource path is too long\n", stderr);
    return 1;
  }

  pid_t pid = fork();
  if (pid < 0) {
    perror("launcher: fork");
    return 1;
  }
  if (pid == 0) {
    if (chdir(executable_directory) != 0) {
      perror("launcher: chdir");
      _exit(1);
    }
    execl("./bun", "./bun", main_script, (char *)NULL);
    perror("launcher: exec bun");
    _exit(1);
  }

  child_pid = pid;
  signal(SIGINT, forward_signal);
  signal(SIGTERM, forward_signal);
  signal(SIGHUP, forward_signal);

  int status = 0;
  while (waitpid(pid, &status, 0) < 0) {
    if (errno != EINTR) {
      perror("launcher: waitpid");
      return 1;
    }
  }

  if (WIFEXITED(status)) {
    return WEXITSTATUS(status);
  }
  if (WIFSIGNALED(status)) {
    return 128 + WTERMSIG(status);
  }
  return 1;
}
