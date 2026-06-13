#!/bin/bash
# SpecDrive script locator — source this file to export paths to bundled scripts.
#
# Usage:
#   . /path/to/specdrive/scripts/specdrive-env.sh
#
# This file is sourced by workflow snippets. Do not set global shell options here.

_comet_env_source="${BASH_SOURCE[0]:-$0}"
_comet_script_dir="$(cd "$(dirname "$_comet_env_source")" && pwd -P)"
_comet_env_sourced=0
(return 0 2>/dev/null) && _comet_env_sourced=1

export SPECDRIVE_GUARD="${SPECDRIVE_GUARD:-${_comet_script_dir}/specdrive-guard.sh}"
export SPECDRIVE_STATE="${SPECDRIVE_STATE:-${_comet_script_dir}/specdrive-state.sh}"
export SPECDRIVE_HANDOFF="${SPECDRIVE_HANDOFF:-${_comet_script_dir}/specdrive-handoff.sh}"
export SPECDRIVE_ARCHIVE="${SPECDRIVE_ARCHIVE:-${_comet_script_dir}/specdrive-archive.sh}"
export SPECDRIVE_YAML_VALIDATE="${SPECDRIVE_YAML_VALIDATE:-${_comet_script_dir}/specdrive-yaml-validate.sh}"

_specdrive_bash_is_usable() {
  local _specdrive_bash_candidate="$1"
  if [ -z "$_specdrive_bash_candidate" ]; then
    return 1
  fi
  case "$_specdrive_bash_candidate" in
    */Windows/System32/bash.exe|*/windows/system32/bash.exe|*\\Windows\\System32\\bash.exe|*\\windows\\system32\\bash.exe)
      return 1
      ;;
  esac
  "$_specdrive_bash_candidate" -lc 'printf specdrive-bash-ok' >/dev/null 2>&1
}

_comet_resolve_bash() {
  local _specdrive_bash_candidate

  if _specdrive_bash_is_usable "${SPECDRIVE_BASH:-}"; then
    printf '%s\n' "$SPECDRIVE_BASH"
    return 0
  fi

  if _specdrive_bash_is_usable "${BASH:-}"; then
    printf '%s\n' "$BASH"
    return 0
  fi

  _specdrive_bash_candidate="$(command -v sh 2>/dev/null | awk '{ sub(/\/sh(\.exe)?$/, "/bash.exe"); print }')"
  if _specdrive_bash_is_usable "$_specdrive_bash_candidate"; then
    printf '%s\n' "$_specdrive_bash_candidate"
    return 0
  fi

  _specdrive_bash_candidate="$(command -v bash 2>/dev/null || true)"
  if _specdrive_bash_is_usable "$_specdrive_bash_candidate"; then
    printf '%s\n' "$_specdrive_bash_candidate"
    return 0
  fi

  return 1
}

SPECDRIVE_BASH="$(_comet_resolve_bash || true)"
export SPECDRIVE_BASH

_comet_env_fail() {
  echo "ERROR: SpecDrive scripts not found. Ensure the SpecDrive skill is installed completely." >&2
  echo "Expected path pattern: */specdrive/scripts/specdrive-*.sh under project or platform skill directories" >&2
}

_specdrive_bash_fail() {
  echo "ERROR: usable bash not found. Install Git Bash or set SPECDRIVE_BASH to a working bash executable." >&2
  echo "Windows WSL launcher bash.exe is not supported for SpecDrive scripts." >&2
}

_comet_env_abort() {
  local _comet_env_was_sourced="$_comet_env_sourced"
  unset _comet_env_source _comet_script_dir _comet_script _comet_env_missing _comet_env_sourced
  unset _specdrive_bash_candidate
  unset -f _comet_env_fail _specdrive_bash_fail _specdrive_bash_is_usable _comet_resolve_bash
  if [ "$_comet_env_was_sourced" -eq 1 ]; then
    unset -f _comet_env_abort
    return 1
  fi
  exit 1
}

_comet_env_missing=0
if [ -z "$SPECDRIVE_BASH" ]; then
  _specdrive_bash_fail
  _comet_env_missing=1
fi
for _comet_script in \
  "$SPECDRIVE_GUARD" \
  "$SPECDRIVE_STATE" \
  "$SPECDRIVE_HANDOFF" \
  "$SPECDRIVE_ARCHIVE" \
  "$SPECDRIVE_YAML_VALIDATE"; do
  if [ ! -f "$_comet_script" ]; then
    _comet_env_fail
    _comet_env_missing=1
    break
  fi
done

if [ "$_comet_env_missing" -ne 0 ]; then
  _comet_env_abort
else
  unset _comet_env_source _comet_script_dir _comet_script _comet_env_missing _comet_env_sourced
  unset _specdrive_bash_candidate
  unset -f _comet_env_fail _specdrive_bash_fail _specdrive_bash_is_usable _comet_resolve_bash _comet_env_abort
fi
