"use client";

import { useState } from "react";

import { Field } from "@/components/ui";

import type { DistrictOption, TehsilOption } from "../places.service";

type Labels = {
  state: string;
  chooseState: string;
  district: string;
  chooseDistrict: string;
  // Only for level "tehsil".
  tehsil?: string;
  chooseTehsil?: string;
  tehsilHint?: string;
};

// State, then that state's districts, then (for level "tehsil") that
// district's tehsils. Only the last code is submitted: `districtCode` for
// level "district", `subdistrictCode` for level "tehsil". Until a state is
// chosen (or without JavaScript) the lists show every option grouped, so the
// form still works on any phone.
export function PlacePicker({
  districts,
  tehsils = [],
  level,
  labels,
  className,
  required = true,
}: {
  districts: DistrictOption[];
  tehsils?: TehsilOption[];
  level: "district" | "tehsil";
  labels: Labels;
  className: string;
  required?: boolean;
}) {
  const [stateName, setStateName] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [tehsilCode, setTehsilCode] = useState("");

  const stateNames = [...new Set(districts.map((district) => district.stateName))];
  const stateDistricts = stateName
    ? districts.filter((district) => district.stateName === stateName)
    : districts;
  const tehsilDistricts = districtCode
    ? stateDistricts.filter((district) => String(district.code) === districtCode)
    : stateDistricts;

  const districtOptions = stateName
    ? stateDistricts.map((district) => (
        <option key={district.code} value={district.code}>
          {district.name}
        </option>
      ))
    : stateNames.map((name) => (
        <optgroup key={name} label={name}>
          {districts
            .filter((district) => district.stateName === name)
            .map((district) => (
              <option key={district.code} value={district.code}>
                {district.name}
              </option>
            ))}
        </optgroup>
      ));

  return (
    <>
      <Field label={labels.state}>
        <select
          className={className}
          value={stateName}
          onChange={(event) => {
            setStateName(event.target.value);
            setDistrictCode("");
            setTehsilCode("");
          }}
        >
          <option value="">{labels.chooseState}</option>
          {stateNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={labels.district}>
        <select
          className={className}
          name={level === "district" ? "districtCode" : undefined}
          required={level === "district" && required}
          value={districtCode}
          onChange={(event) => {
            setDistrictCode(event.target.value);
            setTehsilCode("");
          }}
        >
          <option value="" disabled={level === "district"}>
            {labels.chooseDistrict}
          </option>
          {districtOptions}
        </select>
      </Field>
      {level === "tehsil" ? (
        <Field label={labels.tehsil} hint={labels.tehsilHint}>
          <select
            className={className}
            name="subdistrictCode"
            required={required}
            value={tehsilCode}
            onChange={(event) => setTehsilCode(event.target.value)}
          >
            <option value="" disabled>
              {labels.chooseTehsil}
            </option>
            {tehsilDistricts.map((district) => {
              const options = tehsils
                .filter((tehsil) => tehsil.districtCode === district.code)
                .map((tehsil) => (
                  <option key={tehsil.code} value={tehsil.code}>
                    {tehsil.name}
                  </option>
                ));
              // One district chosen: a plain list; otherwise grouped.
              return districtCode ? (
                options
              ) : (
                <optgroup key={district.code} label={`${district.name}, ${district.stateName}`}>
                  {options}
                </optgroup>
              );
            })}
          </select>
        </Field>
      ) : null}
    </>
  );
}
