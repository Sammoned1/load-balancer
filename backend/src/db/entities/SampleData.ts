import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class SampleData {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("double precision")
  inputA!: number;

  @Column("double precision")
  inputB!: number;

  @Column("double precision")
  weight!: number;
}
