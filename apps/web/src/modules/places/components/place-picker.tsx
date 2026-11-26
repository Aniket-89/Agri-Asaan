"use client";

import { useState } from "react";

import { Field } from "@/components/ui";

import type { DistrictOption, TehsilOption } from "../places.service";

type Labels = {
  district: string;
  chooseDistrict: string;
  tehsil: string;
  chooseTehsil: string;
  tehsilHint?: string;
};

// District, then tehsil. Only the tehsil code is submitted (as `name`). Before
// a district is chosen (or without JavaScript) every tehsil is listed, grouped
// by district, so the form still works on any phone.
export function PlacePicker({
  districts,
  tehsils,
  labels,
  name = "subdistrictCode",
  className,
  required = true,
}: {
  districts: DistrictOption[];
  tehsils: TehsilOption[];
  labels: Labels;
  name?: string;
  className: string;
  required?: boolean;
}) {
  const [districtCode, setDistrictCode] = useState("");
  const [tehsilCode, setTehsilCode] = useState("");

  const states = new Map<string, DistrictOption[]>();
  for (const district of districts) {
    states.set(district.stateName, [...(states.get(district.stateName) ?? []), district]);
  }
  const shownDistricts = districtCode
    ? districts.filter((district) => String(district.code) === districtCode)
    : districts;

  return (
    <>
      <Field label={labels.district}>
        <select
          className={className}
          value={districtCode}
          onChange={(event) => {
            setDistrictCode(event.target.value);
            setTehsilCode("");
          }}
        >
          <option value="">{labels.chooseDistrict}</option>
          {[...states].map(([stateName, stateDistricts]) => (
            <optgroup key={stateName} label={stateName}>
              {stateDistricts.map((district) => (
                <option key={district.code} value={district.code}>
                  {district.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label={labels.tehsil} hint={labels.tehsilHint}>
        <select
          className={className}
          name={name}
          required={required}
          value={tehsilCode}
          onChange={(event) => setTehsilCode(event.target.value)}
        >
          <option value="" disabled>
            {labels.chooseTehsil}
          </option>
          {shownDistricts.map((district) => (
            <optgroup key={district.code} label={`${district.name}, ${district.stateName}`}>
              {tehsils
                .filter((tehsil) => tehsil.districtCode === district.code)
                .map((tehsil) => (
                  <option key={tehsil.code} value={tehsil.code}>
                    {tehsil.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </Field>
    </>
  );
}
